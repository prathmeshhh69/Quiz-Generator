const mongoose = require("mongoose");

function generateSessionCode(length = 6) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";

	for (let i = 0; i < length; i += 1) {
		const index = Math.floor(Math.random() * chars.length);
		code += chars[index];
	}

	return code;
}

const questionSchema = new mongoose.Schema(
	{
		questionText: {
			type: String,
			required: true,
			trim: true
		},
		options: {
			type: [String],
			required: true,
			validate: {
				validator: (value) => Array.isArray(value) && value.length === 4,
				message: "Each question must have exactly 4 options."
			}
		},
		correctIndex: {
			type: Number,
			required: true,
			min: 0,
			max: 3
		},
		timeLimit: {
			type: Number,
			default: 20
		}
	},
	{ _id: false }
);

const quizSchema = new mongoose.Schema({
	title: {
		type: String,
		required: true,
		trim: true
	},
	questions: {
		type: [questionSchema],
		default: []
	},
	createdBy: {
		type: String,
		trim: true
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	sessionCode: {
		type: String,
		unique: true,
		uppercase: true,
		match: /^[A-Z0-9]{6}$/
	}
});

quizSchema.pre("validate", async function setSessionCode() {
	if (!this.isNew || this.sessionCode) {
		return;
	}

	let isUnique = false;
	let attempts = 0;

	while (!isUnique && attempts < 10) {
		attempts += 1;
		const candidate = generateSessionCode(6);
		// Ensure uniqueness before save to reduce duplicate key retries.
		const exists = await this.constructor.exists({ sessionCode: candidate });

		if (!exists) {
			this.sessionCode = candidate;
			isUnique = true;
		}
	}

	if (!isUnique) {
		throw new Error("Unable to generate a unique session code.");
	}
});

module.exports = mongoose.model("Quiz", quizSchema);
