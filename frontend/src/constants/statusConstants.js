export const PROCESSING = 'PROCESSING';
export const COMPLETED = 'COMPLETED';
export const FAILED = 'FAILED';
export const EMPTY = 'EMPTY';

// Engine-side states that may be observed by polling.
export const SUCCESS = 'SUCCESS';
export const STARTED = 'STARTED';
export const RECEIVED = 'RECEIVED';
export const FAILURE = 'FAILURE';
export const PENDING_JOB = 'PENDING_JOB';

export const STATUS = {
    PROCESSING,
    COMPLETED,
    FAILED,
    SUCCESS,
    STARTED,
    RECEIVED,
    FAILURE,
    PENDING_JOB,
    EMPTY
};

export const TERMINAL_STATUSES = [COMPLETED, FAILED, SUCCESS, EMPTY];
export const ACTIVE_STATUSES = [PROCESSING, STARTED, RECEIVED, PENDING_JOB];

export const normalizeStatus = (value) => String(value || '').toUpperCase();
