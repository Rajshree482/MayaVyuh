const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Session = require('../models/Session');
const ImageBank = require('../models/ImageBank');

// ============================================================
// ANTI-CHEAT: In-memory violation store
// Keyed by teamId. Resets when server restarts (intentional —
// keeps it simple without a new DB model).
// Format: { [teamId]: { count, events: [{type, ts}] } }
// ============================================================
const violationLog = {};

// POST /api/anticheat/report
// Called silently by the player's browser on detected violations.
// Never returns an error that could disrupt the client.
router.post('/anticheat/report', (req, res) => {
  try {
    const { teamId, type, count, ts } = req.body;
    if (!teamId) return res.json({ ok: true }); // Silently ignore if no teamId

    if (!violationLog[teamId]) {
      violationLog[teamId] = { count: 0, events: [] };
    }

    violationLog[teamId].count += 1;
    violationLog[teamId].events.push({
      type: type || 'unknown',
      ts: ts || Date.now(),
    });

    // Keep last 50 events per team to avoid memory bloat
    if (violationLog[teamId].events.length > 50) {
      violationLog[teamId].events = violationLog[teamId].events.slice(-50);
    }

    console.log(`[ANTICHEAT] Team ${teamId} | Type: ${type} | Total: ${violationLog[teamId].count}`);
  } catch (err) {
    // Intentionally swallow — never return a 500 to the client
    console.error('[ANTICHEAT] Report error:', err.message);
  }
  // Always return 200 so the client never knows if it succeeded
  res.json({ ok: true });
});

// GET /api/anticheat/violations
// Used by AdminComponents to display the violation panel.
router.get('/anticheat/violations', (req, res) => {
  try {
    res.json({ success: true, violations: violationLog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Existing routes — unchanged
// ============================================================

// Register a Team
router.post('/teams/register', async (req, res) => {
  try {
    const { teamName, player1, player2, role } = req.body;
    
    let activeSession = await Session.findOne({ active: true });
    if (!activeSession) {
      activeSession = new Session({ sessionId: 'session-' + Date.now() });
      await activeSession.save();
    }

    const observer = role === 'observer' ? player1 : player2;
    const creator = role === 'creator' ? player1 : player2;

    const highestTeam = await Team.findOne().sort('-teamNumber');
    const nextTeamNumber = highestTeam && highestTeam.teamNumber ? highestTeam.teamNumber + 1 : 1;

    const newTeam = new Team({
      name: teamName,
      teamNumber: nextTeamNumber,
      observer,
      creator,
      sessionId: activeSession.sessionId,
      status: 'pending'
    });

    await newTeam.save();
    res.json({ success: true, team: newTeam });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ban a Team
router.post('/game/teams/:id/ban', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    team.status = 'banned';
    await team.save();
    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Start Event / Round 1
router.post('/admin/start-event', async (req, res) => {
  try {
    let session = await Session.findOne({ active: true });
    if (!session) return res.status(400).json({ error: 'No active session' });

    session.status = 'round1';
    await session.save();

    const teams = await Team.find({ sessionId: session.sessionId });
    const images = await ImageBank.find({ used: false });

    if (images.length < teams.length) {
      return res.status(400).json({ error: 'Not enough images in ImageBank' });
    }

    for (let i = 0; i < teams.length; i++) {
      teams[i].status = 'active';
      await teams[i].save();
    }

    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit final image
router.post('/submit', async (req, res) => {
  try {
    const Submission = require('../models/Submission');
    const { teamId, imageUrl } = req.body;
    
    const newSubmission = new Submission({
      team: teamId,
      session: null,
      finalImageUrl: imageUrl,
    });
    
    await newSubmission.save();
    res.json({ success: true, submission: newSubmission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get all teams
router.get('/admin/teams', async (req, res) => {
  try {
    const teams = await Team.find().sort({ createdAt: -1 });
    res.json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get leaderboard
router.get('/admin/leaderboard', async (req, res) => {
  try {
    const teams = await Team.find().sort({ score: -1, totalTime: 1 });
    res.json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;