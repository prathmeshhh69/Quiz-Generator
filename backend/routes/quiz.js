const express = require("express");
const Quiz = require("../models/Quiz");
const Session = require("../models/Session");

const router = express.Router();

function sanitizeQuizForStudent(quiz) {
	return {
		_id: quiz._id,
		title: quiz.title,
		sessionCode: quiz.sessionCode,
		createdBy: quiz.createdBy,
		createdAt: quiz.createdAt,
		questions: quiz.questions.map((question) => ({
			questionText: question.questionText,
			options: question.options,
			timeLimit: question.timeLimit
		}))
	};
}

router.post("/create", async (req, res) => {
	try {
		const { title, questions = [], createdBy } = req.body;

		if (!title) {
			res.status(400).json({ message: "title is required." });
			return;
		}

		const quiz = await Quiz.create({
			title,
			questions,
			createdBy
		});

		await Session.create({
			sessionCode: quiz.sessionCode,
			quizId: quiz._id,
			status: "waiting",
			currentQuestion: 0,
			participants: []
		});

		res.status(201).json(quiz);
	} catch (error) {
		res.status(500).json({ message: "Failed to create quiz." });
	}
});

router.get("/:sessionCode/full", async (req, res) => {
	try {
		const sessionCode = String(req.params.sessionCode || "").toUpperCase();
		const quiz = await Quiz.findOne({ sessionCode });

		if (!quiz) {
			res.status(404).json({ message: "Quiz not found." });
			return;
		}

		res.json(quiz);
	} catch (error) {
		res.status(500).json({ message: "Failed to fetch quiz." });
	}
});

router.get("/:sessionCode", async (req, res) => {
	try {
		const sessionCode = String(req.params.sessionCode || "").toUpperCase();
		const quiz = await Quiz.findOne({ sessionCode });

		if (!quiz) {
			res.status(404).json({ message: "Quiz not found." });
			return;
		}

		res.json(sanitizeQuizForStudent(quiz));
	} catch (error) {
		res.status(500).json({ message: "Failed to fetch quiz." });
	}
});

router.delete("/:id", async (req, res) => {
	try {
		const quiz = await Quiz.findByIdAndDelete(req.params.id);

		if (!quiz) {
			res.status(404).json({ message: "Quiz not found." });
			return;
		}

		await Session.deleteOne({ quizId: quiz._id });

		res.json({ message: "Quiz deleted successfully." });
	} catch (error) {
		res.status(500).json({ message: "Failed to delete quiz." });
	}
});

module.exports = router;
