const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Session = require('../models/Session');
const ImageBank = require('../models/ImageBank');

// Register a Team
router.post('/teams/register', async (req, res) => {
  try {
    const { teamName, player1, player2, role } = req.body;
    
    // Check if active session exists
    let activeSession = await Session.findOne({ active: true });
    if (!activeSession) {
      activeSession = new Session({ sessionId: 'session-' + Date.now() });
      await activeSession.save();
    }

    const observer = role === 'observer' ? player1 : player2;
    const creator = role === 'creator' ? player1 : player2;

    const newTeam = new Team({
      name: teamName,
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

// Admin: Start Event / Round 1
router.post('/admin/start-event', async (req, res) => {
  try {
    let session = await Session.findOne({ active: true });
    if (!session) return res.status(400).json({ error: 'No active session' });

    session.status = 'round1';
    await session.save();

    // Assign random images to all pending/approved teams
    const teams = await Team.find({ sessionId: session.sessionId });
    const images = await ImageBank.find({ used: false });

    if (images.length < teams.length) {
      return res.status(400).json({ error: 'Not enough images in ImageBank' });
    }

    for (let i = 0; i < teams.length; i++) {
      teams[i].status = 'active';
      await teams[i].save();
      
      images[i].assignedTeam = teams[i]._id;
      images[i].used = true;
      await images[i].save();
    }

    // Returning success, the main server should broadcast this state change via socket
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
      session: null, // Should link to current session ID ideally
      finalImageUrl: imageUrl,
    });
    
    await newSubmission.save();
    
    // We can call the python AI similarity service here asynchronously
    // but for now we just acknowledge receipt
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
