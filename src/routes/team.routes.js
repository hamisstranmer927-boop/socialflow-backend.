const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { TeamMember, User } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/team
 * List team members for current user
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const members = await TeamMember.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/team/invite
 * Invite a new member to the team
 */
router.post('/invite', authenticate, async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email) throw new ApiError(400, 'Email is required.');

    const member = await TeamMember.create({
      userId: req.userId,
      memberEmail: email,
      role: role || 'editor',
      inviteStatus: 'pending',
    });

    res.status(201).json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/team/:id
 * Remove team member
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const member = await TeamMember.findOne({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!member) throw new ApiError(404, 'Team member not found.');

    await member.destroy();

    res.json({ success: true, message: 'Member removed from team.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
