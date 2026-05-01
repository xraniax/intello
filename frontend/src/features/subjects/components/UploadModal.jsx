import React from 'react';
import CustomModal from '@/components/ui/CustomModal';
import FileUpload from '@/components/FileUpload';

const UploadModal = ({
    isOpen,
    onClose,
    subjectId,
    onSuccess
}) => {
    return (
        <CustomModal isOpen={isOpen} onClose={onClose} title="Garden Expansion" showFooter={false}>
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
        </CustomModal>
    );
};

export default UploadModal;
