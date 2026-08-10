const { v4: uuidv4 } = require('uuid');

const HISTORY_TTL_HOURS = Number(process.env.REQUEST_TTL_HOURS || 24);

const active = new Map(); // id -> request
const activeByAgent = new Map(); // agentId -> id
const history = []; // resolved requests, newest first

function createRequest(payload) {
  const existingId = activeByAgent.get(payload.agentId);
  if (existingId) {
    active.delete(existingId);
  }

  const now = new Date().toISOString();
  const request = {
    id: uuidv4(),
    agentId: payload.agentId,
    agentName: payload.agentName,
    teamId: payload.teamId || '',
    teamName: payload.teamName || '',
    interactionId: payload.interactionId || null,
    channelType: payload.channelType || 'none',
    reason: payload.reason || 'other',
    note: (payload.note || '').slice(0, 280),
    status: 'active',
    acknowledgedBy: null,
    raisedAt: now,
    acknowledgedAt: null,
    resolvedAt: null
  };

  active.set(request.id, request);
  activeByAgent.set(request.agentId, request.id);
  return request;
}

function lowerByAgent(agentId) {
  const id = activeByAgent.get(agentId);
  if (!id) return null;
  const request = active.get(id);
  active.delete(id);
  activeByAgent.delete(agentId);
  return request || null;
}

function acknowledge(id, supervisorId, supervisorName) {
  const request = active.get(id);
  if (!request) return null;
  request.status = 'acknowledged';
  request.acknowledgedBy = supervisorName || supervisorId;
  request.acknowledgedAt = new Date().toISOString();
  return request;
}

function resolve(id, supervisorId, supervisorName) {
  const request = active.get(id);
  if (!request) return null;
  request.status = 'resolved';
  request.resolvedAt = new Date().toISOString();
  request.resolvedBy = supervisorName || supervisorId;

  active.delete(id);
  activeByAgent.delete(request.agentId);
  history.unshift(request);
  pruneHistory();
  return request;
}

function pruneHistory() {
  const cutoff = Date.now() - HISTORY_TTL_HOURS * 60 * 60 * 1000;
  while (history.length && new Date(history[history.length - 1].resolvedAt).getTime() < cutoff) {
    history.pop();
  }
}

function getActive(teamId) {
  const all = Array.from(active.values());
  return teamId ? all.filter((r) => r.teamId === teamId) : all;
}

function getHistory(teamId) {
  pruneHistory();
  return teamId ? history.filter((r) => r.teamId === teamId) : history;
}

function getById(id) {
  return active.get(id) || null;
}

module.exports = {
  createRequest,
  lowerByAgent,
  acknowledge,
  resolve,
  getActive,
  getHistory,
  getById
};
