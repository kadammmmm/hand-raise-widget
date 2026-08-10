const HEARTBEAT_MS = 30000;

class SSEManager {
  constructor() {
    this.supervisorClients = new Map(); // teamId ('' = all) -> Set<res>
    this.agentClients = new Map(); // agentId -> res
    this._heartbeat = setInterval(() => this._sendHeartbeats(), HEARTBEAT_MS);
  }

  _initResponse(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 3000\n\n');
  }

  addSupervisorClient(teamId, res) {
    this._initResponse(res);
    const key = teamId || '';
    if (!this.supervisorClients.has(key)) this.supervisorClients.set(key, new Set());
    this.supervisorClients.get(key).add(res);

    res.on('close', () => {
      this.supervisorClients.get(key)?.delete(res);
    });
  }

  addAgentClient(agentId, res) {
    this._initResponse(res);
    this.agentClients.set(agentId, res);

    res.on('close', () => {
      if (this.agentClients.get(agentId) === res) {
        this.agentClients.delete(agentId);
      }
    });
  }

  _write(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  broadcastToTeam(teamId, event, data) {
    // Send to supervisors watching this specific team AND supervisors watching all teams ('')
    const targets = new Set([...(this.supervisorClients.get(teamId) || []), ...(this.supervisorClients.get('') || [])]);
    for (const res of targets) {
      this._write(res, event, data);
    }
  }

  notifyAgent(agentId, event, data) {
    const res = this.agentClients.get(agentId);
    if (res) this._write(res, event, data);
  }

  _sendHeartbeats() {
    for (const set of this.supervisorClients.values()) {
      for (const res of set) res.write(': heartbeat\n\n');
    }
    for (const res of this.agentClients.values()) {
      res.write(': heartbeat\n\n');
    }
  }
}

module.exports = new SSEManager();
