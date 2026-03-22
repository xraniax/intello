import AdminService from '../services/admin.service.js';

class AdminController {
    /**
     * Get all users for administration
     */
    static async getUsers(req, res) {
        try {
            const users = await AdminService.getAllUsers();
            res.json({ success: true, data: users });
        } catch (error) {
            console.error('Admin Fetch Users Error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch users' });
        }
    }

    /**
     * Update user status (Active/Suspended)
     */
    static async updateStatus(req, res) {
        const { id } = req.params;
        const { status, reason } = req.body;
        
        console.log(`[Admin] Updating status for user ${id} to ${status} by admin ${req.user.id}`);

        try {
            const user = await AdminService.updateUserStatus(req.user.id, id, status, reason);
            if (!user) {
                console.warn(`[Admin] No user found with ID ${id} to update status`);
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            res.json({ success: true, data: user, message: `User status updated to ${status}` });
        } catch (error) {
            console.error('Admin Update Status Error:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to update user status' });
        }
    }

    /**
     * Update user role (e.g., Promote to Admin)
     */
    static async updateRole(req, res) {
        const { id } = req.params;
        const { role } = req.body;

        try {
            const user = await AdminService.updateUserRole(req.user.id, id, role);
            res.json({ success: true, data: user, message: `User role updated to ${role}` });
        } catch (error) {
            console.error('Admin Update Role Error:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to update user role' });
        }
    }

    /**
     * Delete user permanently
     */
    static async deleteUser(req, res) {
        const { id } = req.params;
        console.log(`[Admin] Deleting user ${id} by admin ${req.user.id}`);

        try {
            const success = await AdminService.deleteUser(req.user.id, id);
            if (!success) {
                console.warn(`[Admin] Failed to delete user ${id} or user not found`);
                return res.status(404).json({ success: false, message: 'User not found or deletion failed' });
            }
            res.json({ success: true, message: 'User deleted permanently' });
        } catch (error) {
            console.error('Admin Delete User Error:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to delete user' });
        }
    }

    /**
     * Get administrative action logs
     */
    static async getLogs(req, res) {
        try {
            const logs = await AdminService.getAdminLogs();
            res.json({ success: true, data: logs });
        } catch (error) {
            console.error('Admin Fetch Logs Error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch admin logs' });
        }
    }
    /**
     * File Management
     */
    static async getAllFiles(req, res) {
        try {
            const { userId, subjectId, minSizeMb, mimeType } = req.query;
            const files = await AdminService.getAllFiles({ userId, subjectId, minSizeMb, mimeType });
            res.status(200).json({ success: true, data: files });
        } catch (error) {
            console.error('Admin Fetch Files Error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch files' });
        }
    }

    static async deleteFile(req, res) {
        try {
            const { id } = req.params;
            await AdminService.deleteFile(req.user.id, id);
            res.status(200).json({ success: true, message: 'File deleted successfully' });
        } catch (error) {
            console.error('Admin Delete File Error:', error);
            res.status(500).json({ success: false, message: 'Failed to delete file' });
        }
    }

    /**
     * Settings Management
     */
    static async getSettings(req, res) {
        try {
            const settings = await AdminService.getSettings();
            res.status(200).json({ success: true, data: settings });
        } catch (error) {
            console.error('Admin Fetch Settings Error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch settings' });
        }
    }

    static async updateSettings(req, res) {
        try {
            const settings = await AdminService.updateSettings(req.user.id, req.body);
            res.status(200).json({ success: true, data: settings });
        } catch (error) {
            console.error('Admin Update Settings Error:', error);
            res.status(500).json({ success: false, message: 'Failed to update settings' });
        }
    }

    /**
     * Storage Limit Override
     */
    static async updateStorageLimit(req, res) {
        try {
            const { userId } = req.params; // Wait, admin.routes.js mapped this to :userId. Let me double check that. In admin.routes.js: router.patch('/users/:userId/storage-limit', ...)
            const { limitBytes } = req.body;
            const user = await AdminService.updateUserStorageLimit(req.user.id, userId, limitBytes);
            res.status(200).json({ success: true, data: user });
        } catch (error) {
            console.error('Admin Update Storage Limit Error:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to update storage limit' });
        }
    }
}

export default AdminController;
