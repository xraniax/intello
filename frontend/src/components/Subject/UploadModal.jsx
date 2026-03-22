import React from 'react';
import Modal from '../Common/Modal';
import FileUpload from '../Common/FileUpload';

const UploadModal = ({
    isOpen,
    onClose,
    subjectId,
    onSuccess
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Garden Expansion">
            <div className="p-1">
                <FileUpload 
                    subjectId={subjectId}
                    onSuccess={(data) => {
                        onSuccess(data);
                        onClose();
                    }}
                    onCancel={onClose}
                    inline={true}
                />
            </div>
        </Modal>
    );
};

export default UploadModal;
