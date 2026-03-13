const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
	{
		questionIndex: {
			type: Number,
			required: true
		},
		selectedOption: {
			type: Number,
			required: true
		},
		isCorrect: {
			type: Boolean,
			required: true
		},
		timeTaken: {
			type: Number,
			required: true
		}
	},
	{ _id: false }
);

const participantSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true
		},
		socketId: {
			type: String,
			required: true,
			trim: true
		},
		score: {
			type: Number,
			default: 0
		},
		answers: {
			type: [answerSchema],
			default: []
		}
	},
	{ _id: false }
);

const sessionSchema = new mongoose.Schema({
	sessionCode: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		uppercase: true
	},
	quizId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Quiz"
	},
	status: {
		type: String,
		enum: ["waiting", "active", "finished"],
		default: "waiting"
	},
	currentQuestion: {
		type: Number,
		default: 0
	},
	participants: {
		type: [participantSchema],
		default: []
	},
	startedAt: {
		type: Date
	},
	endedAt: {
		type: Date
	}
});

module.exports = mongoose.model("Session", sessionSchema);
