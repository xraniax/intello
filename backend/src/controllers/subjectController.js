import { insertSubject, fetchAllSubjects } from "../models/subjectModel.js";

export const createSubject = async (req, res) => {
  const { name, description } = req.body;
  try {
    const subject = await insertSubject(name, description);
    res.json(subject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
};

export const getSubjects = async (req, res) => {
  try {
    const subjects = await fetchAllSubjects();
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
};
