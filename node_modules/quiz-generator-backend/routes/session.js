const express = require("express");
const Session = require("../models/Session");
const Quiz = require("../models/Quiz");

const router = express.Router();

function generateSessionCode(length = 6) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";

	for (let i = 0; i < length; i += 1) {
		const index = Math.floor(Math.random() * chars.length);
		code += chars[index];
	}

	return code;
}

async function getUniqueSessionCode() {
	let attempts = 0;

	while (attempts < 20) {
		attempts += 1;
		const code = generateSessionCode(6);
		const exists = await Session.exists({ sessionCode: code });

		if (!exists) {
			return code;
		}
	}

	throw new Error("Unable to generate a unique session code.");
}

router.post("/create", async (req, res) => {
	try {
		const { quizId } = req.body;

		if (!quizId) {
			res.status(400).json({ message: "quizId is required." });
			return;
		}

		const quiz = await Quiz.findById(quizId);

		if (!quiz) {
			res.status(404).json({ message: "Quiz not found." });
			return;
		}

		const sessionCode = await getUniqueSessionCode();
		await Session.create({
			sessionCode,
			quizId: quiz._id,
			status: "waiting",
			currentQuestion: 0,
			participants: []
		});

		res.status(201).json({ sessionCode });
	} catch (error) {
		res.status(500).json({ message: "Failed to create session." });
	}
});

router.get("/:sessionCode", async (req, res) => {
	try {
		const sessionCode = String(req.params.sessionCode || "").toUpperCase();
		const session = await Session.findOne({ sessionCode }).lean();

		if (!session) {
			res.status(404).json({ message: "Session not found." });
			return;
		}

		res.json({
			_id: session._id,
			sessionCode: session.sessionCode,
			quizId: session.quizId,
			status: session.status,
			currentQuestion: session.currentQuestion,
			participants: (session.participants || []).map((participant) => ({
				name: participant.name,
				socketId: participant.socketId,
				score: participant.score
			})),
			startedAt: session.startedAt,
			endedAt: session.endedAt
		});
	} catch (error) {
		res.status(500).json({ message: "Failed to fetch session." });
	}
});

router.get("/:sessionCode/leaderboard", async (req, res) => {
	try {
		const sessionCode = String(req.params.sessionCode || "").toUpperCase();
		const session = await Session.findOne({ sessionCode })
			.populate({ path: "quizId", select: "questions" })
			.lean();

		if (!session) {
			res.status(404).json({ message: "Session not found." });
			return;
		}

		const participants = (session.participants || [])
			.map((participant) => ({
				name: participant.name,
				score: participant.score
			}))
			.sort((a, b) => b.score - a.score);

		const leaderboard = participants.slice(0, 10);
		const totalQuestions = Array.isArray(session.quizId?.questions)
			? session.quizId.questions.length
			: 0;
		const averageScore = participants.length
			? Math.round(
					participants.reduce((sum, participant) => sum + participant.score, 0) /
						participants.length
			  )
			: 0;

		res.json({
			sessionCode: session.sessionCode,
			leaderboard,
			participants,
			totalQuestions,
			averageScore
		});
	} catch (error) {
		res.status(500).json({ message: "Failed to fetch leaderboard." });
	}
});

module.exports = router;
