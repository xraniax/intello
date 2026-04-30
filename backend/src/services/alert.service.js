import SystemAlert from '../models/system_alert.model.js';

class AlertService {
    static async triggerGenerationFailure(userId, materialId, errorMsg) {
        return await SystemAlert.create({
            type: 'GENERATION_FAILURE',
            severity: 'ERROR',
            title: 'AI Material Generation Failed',
            message: errorMsg,
            userId,
            entityId: materialId
        });
    }

    static async triggerUploadFailure(userId, fileName, errorMsg) {
        return await SystemAlert.create({
            type: 'UPLOAD_FAILURE',
            severity: 'WARNING',
            title: 'File Upload Error',
            message: `Failed to process/upload: ${fileName}. Reason: ${errorMsg}`,
            userId
        });
    }

    static async triggerStorageCritical(ceilingGb, currentUsageGb) {
        return await SystemAlert.create({
            type: 'STORAGE_CRITICAL',
            severity: 'CRITICAL',
            title: 'Platform Storage Critical',
            message: `Platform is nearing total capacity. Ceiling: ${ceilingGb}GB, Current: ${currentUsageGb}GB`,
        });
    }

    static async getRecentAlerts(filters = {}) {
        return await SystemAlert.findAll(filters);
    }

    static async resolveAlert(alertId) {
        return await SystemAlert.resolve(alertId);
    }

    static async deleteAlert(alertId) {
        return await SystemAlert.delete(alertId);
    }

    static async getStats() {
        const unresolved = await SystemAlert.getUnresolvedCount();
        return { unresolved_count: unresolved };
    }
}

export default AlertService;
