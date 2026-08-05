const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { MediaLibrary } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// ─── Multer Configuration ────────────────────────────────

const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/x-msvideo',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `File type ${file.mimetype} not allowed.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 10,
  },
});

/**
 * POST /api/media/upload
 * Upload one or more media files
 */
router.post('/upload', authenticate, uploadLimiter, upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ApiError(400, 'No files uploaded.');
    }

    const mediaItems = [];

    for (const file of req.files) {
      const mediaType = file.mimetype.startsWith('video') ? 'video'
        : file.mimetype === 'image/gif' ? 'gif' : 'image';

      const fileUrl = `${process.env.APP_URL}/uploads/${file.filename}`;

      const media = await MediaLibrary.create({
        userId: req.userId,
        fileName: file.originalname,
        fileUrl,
        mediaType,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      mediaItems.push(media);
    }

    res.status(201).json({
      success: true,
      data: mediaItems,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/media
 * List user's media library
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type, limit, offset } = req.query;
    const where = { userId: req.userId };

    if (type && ['image', 'video', 'gif'].includes(type)) {
      where.mediaType = type;
    }

    const media = await MediaLibrary.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });

    res.json({ success: true, data: media });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/media/:id
 * Delete a media file
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const media = await MediaLibrary.findOne({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!media) throw new ApiError(404, 'Media not found.');

    // Delete file from disk
    try {
      const fileName = media.fileUrl.split('/uploads/').pop();
      if (fileName) {
        const filePath = path.join(process.env.UPLOAD_DIR || './uploads', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (fileErr) {
      console.warn('⚠️ Could not delete file from disk:', fileErr.message);
    }
    await media.destroy();

    res.json({ success: true, message: 'Media deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
