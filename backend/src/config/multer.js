import multer from "multer";

const storage = multer.diskStorage({  
  destination: 'uploads',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + '-' + file.originalname);
  }
});

export { storage };
