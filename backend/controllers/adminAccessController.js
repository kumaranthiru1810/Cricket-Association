/**
 * controllers/adminAccessController.js
 * 
 * Controller for High-Security Dual-Admin Access Delegation & Revocation
 */

const adminAccessService = require('../services/adminAccessService');

class AdminAccessController {
  async getAdmins(req, res) {
    try {
      const data = await adminAccessService.getActiveAdmins(req.user?.id || req.user?.email);
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async getCandidates(req, res) {
    try {
      const { email } = req.query;
      const data = await adminAccessService.searchCandidate(email);
      return res.status(200).json({ success: true, ...data });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async requestPromote(req, res) {
    try {
      const { email, name } = req.body;
      const data = await adminAccessService.requestPromote({
        email,
        name,
        requestedBy: req.user,
        ip: req.ip || req.connection?.remoteAddress
      });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async verifyDualOtp(req, res) {
    try {
      const { id } = req.params;
      const { otp1, otp2 } = req.body;
      const data = await adminAccessService.verifyDualOtp({
        requestId: id,
        otp1,
        otp2,
        userId: req.user?.email,
        ip: req.ip || req.connection?.remoteAddress
      });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async resendDualOtp(req, res) {
    try {
      const { id } = req.params;
      const data = await adminAccessService.resendDualOtp({
        requestId: id,
        userId: req.user?.email,
        ip: req.ip || req.connection?.remoteAddress
      });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async verifyCandidateOtp(req, res) {
    try {
      const { id } = req.params;
      const { code } = req.body;
      const data = await adminAccessService.verifyCandidateAndGrant({
        requestId: id,
        code,
        ip: req.ip || req.connection?.remoteAddress
      });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async requestRemove(req, res) {
    try {
      const { targetAdminId } = req.body;
      const data = await adminAccessService.requestRemove({
        targetAdminId,
        requestedBy: req.user,
        ip: req.ip || req.connection?.remoteAddress
      });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async verifyRemove(req, res) {
    try {
      const { id } = req.params;
      const { otp1, otp2 } = req.body;
      const data = await adminAccessService.verifyRemove({
        requestId: id,
        otp1,
        otp2,
        userId: req.user?.email,
        ip: req.ip || req.connection?.remoteAddress
      });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async getRequests(req, res) {
    try {
      const data = await adminAccessService.getRequests();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async getAudit(req, res) {
    try {
      const data = await adminAccessService.getAuditLog();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new AdminAccessController();
