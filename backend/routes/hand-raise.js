const express = require('express');
const store = require('../store');
const sse = require('../sse-manager');

const router = express.Router();

const SSE_EVENTS = {
  NEW: 'hand-raise:new',
  LOWERED: 'hand-raise:lowered',
  ACKNOWLEDGED: 'hand-raise:acknowledged',
  RESOLVED: 'hand-raise:resolved'
};

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.post('/hand-raise', (req, res) => {
  const { agentId, agentName, teamId, teamName, interactionId, channelType, reason, priority, note } = req.body || {};

  if (!agentId || !agentName) {
    return res.status(400).json({ error: 'agentId and agentName are required' });
  }

  const request = store.createRequest({
    agentId,
    agentName,
    teamId,
    teamName,
    interactionId,
    channelType,
    reason,
    priority,
    note
  });

  sse.broadcastToTeam(request.teamId, SSE_EVENTS.NEW, request);
  res.status(201).json(request);
});

router.delete('/hand-raise/:agentId', (req, res) => {
  const request = store.lowerByAgent(req.params.agentId);
  if (!request) return res.status(404).json({ error: 'No active request for agent' });

  sse.broadcastToTeam(request.teamId, SSE_EVENTS.LOWERED, { id: request.id, agentId: request.agentId });
  res.json({ ok: true });
});

router.get('/hand-raise', (req, res) => {
  res.json(store.getActive(req.query.teamId));
});

router.get('/hand-raise/history', (req, res) => {
  res.json(store.getHistory(req.query.teamId));
});

router.patch('/hand-raise/:id/acknowledge', (req, res) => {
  const { supervisorId, supervisorName } = req.body || {};
  const request = store.acknowledge(req.params.id, supervisorId, supervisorName);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  sse.broadcastToTeam(request.teamId, SSE_EVENTS.ACKNOWLEDGED, request);
  sse.notifyAgent(request.agentId, SSE_EVENTS.ACKNOWLEDGED, request);
  res.json(request);
});

router.patch('/hand-raise/:id/resolve', (req, res) => {
  const { supervisorId, supervisorName } = req.body || {};
  const request = store.resolve(req.params.id, supervisorId, supervisorName);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  sse.broadcastToTeam(request.teamId, SSE_EVENTS.RESOLVED, request);
  sse.notifyAgent(request.agentId, SSE_EVENTS.RESOLVED, request);
  res.json(request);
});

router.get('/hand-raise/stream', (req, res) => {
  sse.addSupervisorClient(req.query.teamId || '', res);
});

router.get('/hand-raise/stream/agent', (req, res) => {
  const { agentId } = req.query;
  if (!agentId) return res.status(400).end();
  sse.addAgentClient(agentId, res);
});

module.exports = router;
