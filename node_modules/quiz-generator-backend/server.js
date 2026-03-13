require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Session = require("./models/Session");
const quizRouter = require("./routes/quiz");
const sessionRouter = require("./routes/session");
const hostRouter = require("./routes/host");

const app = express();
const allowedOrigin = "http://localhost:5173";

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

app.use(
  cors({
    origin: allowedOrigin
  })
);
app.use(express.json());
app.use("/api/quiz", quizRouter);
app.use("/api/session", sessionRouter);
app.use("/api/host", hostRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

function withoutCorrectAnswer(question) {
  if (!question) {
    return null;
  }

  return {
    questionText: question.questionText,
    options: question.options,
    timeLimit: question.timeLimit
  };
}

const socketMetaById = new Map();
const hostSocketBySession = new Map();

function emitErrorOccurred(socket, eventName, message) {
  socket.emit("error-occurred", {
    message,
    event: eventName
  });
}

function emitSessionNotFound(socket, eventName) {
  socket.emit("session-not-found", {
    message: "Session not found.",
    event: eventName
  });
  emitErrorOccurred(socket, eventName, "Session not found.");
}

io.on("connection", (socket) => {
  socket.emit("connected", { socketId: socket.id });

  socket.on("join-session", async ({ sessionCode, studentName }) => {
    try {
      if (!sessionCode || !studentName) {
        emitErrorOccurred(socket, "join-session", "sessionCode and studentName are required.");
        return;
      }

      const normalizedCode = String(sessionCode).toUpperCase();
      const normalizedName = String(studentName).trim();

      const session = await Session.findOne({ sessionCode: normalizedCode });

      if (!session) {
        emitSessionNotFound(socket, "join-session");
        return;
      }

      if (session.status === "active" || session.status === "finished") {
        socket.emit("session-already-started", {
          message: "Session already active or finished.",
          event: "join-session"
        });
        emitErrorOccurred(socket, "join-session", "Session already active or finished.");
        return;
      }

      const existingParticipant = session.participants.find(
        (participant) => participant.name === normalizedName
      );

      if (existingParticipant) {
        socket.emit("duplicate-name", {
          message: "This name is already used in the session. Choose another.",
          event: "join-session"
        });
        emitErrorOccurred(socket, "join-session", "Duplicate student name in session.");
        return;
      }

      session.participants.push({
        name: normalizedName,
        socketId: socket.id
      });

      await session.save();
      socket.join(normalizedCode);
      socketMetaById.set(socket.id, {
        role: "student",
        sessionCode: normalizedCode,
        studentName: normalizedName
      });

      socket.emit("joined-success", {
        sessionCode: normalizedCode,
        studentName: normalizedName,
        status: session.status
      });
    } catch (error) {
      emitErrorOccurred(socket, "join-session", "Unable to join session.");
    }
  });

  socket.on("start-quiz", async ({ sessionCode }) => {
    try {
      if (!sessionCode) {
        emitErrorOccurred(socket, "start-quiz", "sessionCode is required.");
        return;
      }

      const normalizedCode = String(sessionCode).toUpperCase();
      socket.join(normalizedCode);

      const session = await Session.findOne({ sessionCode: normalizedCode }).populate("quizId");

      if (!session) {
        emitSessionNotFound(socket, "start-quiz");
        return;
      }

      if (!session.quizId) {
        emitErrorOccurred(socket, "start-quiz", "Quiz not found for this session.");
        return;
      }

      session.status = "active";
      session.currentQuestion = 0;
      if (!session.startedAt) {
        session.startedAt = new Date();
      }
      await session.save();
      hostSocketBySession.set(normalizedCode, socket.id);
      socketMetaById.set(socket.id, {
        role: "host",
        sessionCode: normalizedCode
      });

      const firstQuestion = session.quizId.questions[0];
      io.to(normalizedCode).emit("quiz-started", {
        sessionCode: normalizedCode,
        questionIndex: 0,
        question: withoutCorrectAnswer(firstQuestion)
      });
    } catch (error) {
      emitErrorOccurred(socket, "start-quiz", "Unable to start quiz.");
    }
  });

  socket.on("next-question", async ({ sessionCode, questionIndex }) => {
    try {
      if (!sessionCode || typeof questionIndex !== "number") {
        emitErrorOccurred(socket, "next-question", "sessionCode and questionIndex are required.");
        return;
      }

      const normalizedCode = String(sessionCode).toUpperCase();
      const session = await Session.findOne({ sessionCode: normalizedCode }).populate("quizId");

      if (!session) {
        emitSessionNotFound(socket, "next-question");
        return;
      }

      if (!session.quizId) {
        emitErrorOccurred(socket, "next-question", "Quiz not found for this session.");
        return;
      }

      const question = session.quizId.questions[questionIndex];

      if (!question) {
        emitErrorOccurred(socket, "next-question", "Question not found.");
        return;
      }

      session.currentQuestion = questionIndex;
      await session.save();

      io.to(normalizedCode).emit("new-question", {
        sessionCode: normalizedCode,
        questionIndex,
        question: withoutCorrectAnswer(question)
      });
    } catch (error) {
      emitErrorOccurred(socket, "next-question", "Unable to move to next question.");
    }
  });

  socket.on(
    "submit-answer",
    async ({ sessionCode, studentName, questionIndex, selectedOption, timeTaken }) => {
      try {
        if (!sessionCode || !studentName || typeof questionIndex !== "number") {
          emitErrorOccurred(
            socket,
            "submit-answer",
            "Required answer payload fields are missing."
          );
          return;
        }

        const normalizedCode = String(sessionCode).toUpperCase();
        const normalizedName = String(studentName).trim();
        const safeTimeTaken = Number(timeTaken) || 0;

        const session = await Session.findOne({ sessionCode: normalizedCode }).populate("quizId");

        if (!session) {
          emitSessionNotFound(socket, "submit-answer");
          return;
        }

        if (!session.quizId) {
          emitErrorOccurred(socket, "submit-answer", "Quiz not found for this session.");
          return;
        }

        const participant = session.participants.find(
          (item) => item.name === normalizedName
        );

        if (!participant) {
          emitErrorOccurred(socket, "submit-answer", "Participant not found in session.");
          return;
        }

        const question = session.quizId.questions[questionIndex];

        if (!question) {
          emitErrorOccurred(socket, "submit-answer", "Question not found.");
          return;
        }

        const isCorrect = question.correctIndex === selectedOption;
        const awardedScore = isCorrect
          ? Math.max(100, 1000 - Math.floor(safeTimeTaken * 10))
          : 0;

        participant.score += awardedScore;
        participant.answers.push({
          questionIndex,
          selectedOption,
          isCorrect,
          timeTaken: safeTimeTaken
        });

        await session.save();

        socket.emit("answer-received", {
          sessionCode: normalizedCode,
          studentName: normalizedName,
          questionIndex,
          isCorrect,
          correctIndex: question.correctIndex,
          awardedScore,
          totalScore: participant.score
        });
      } catch (error) {
        emitErrorOccurred(socket, "submit-answer", "Unable to submit answer.");
      }
    }
  );

  socket.on("end-quiz", async ({ sessionCode }) => {
    try {
      if (!sessionCode) {
        emitErrorOccurred(socket, "end-quiz", "sessionCode is required.");
        return;
      }

      const normalizedCode = String(sessionCode).toUpperCase();
      const session = await Session.findOne({ sessionCode: normalizedCode });

      if (!session) {
        emitSessionNotFound(socket, "end-quiz");
        return;
      }

      session.status = "finished";
      session.endedAt = new Date();
      await session.save();

      const leaderboard = [...session.participants]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((participant) => ({
          name: participant.name,
          score: participant.score
        }));

      io.to(normalizedCode).emit("quiz-ended", {
        sessionCode: normalizedCode,
        leaderboard
      });
    } catch (error) {
      emitErrorOccurred(socket, "end-quiz", "Unable to end quiz.");
    }
  });

  socket.on("get-participants", async ({ sessionCode }) => {
    try {
      if (!sessionCode) {
        emitErrorOccurred(socket, "get-participants", "sessionCode is required.");
        return;
      }

      const normalizedCode = String(sessionCode).toUpperCase();
      const session = await Session.findOne({ sessionCode: normalizedCode });

      if (!session) {
        emitSessionNotFound(socket, "get-participants");
        return;
      }

      const participants = session.participants.map((participant) => ({
        name: participant.name,
        socketId: participant.socketId,
        score: participant.score
      }));

      socket.emit("participants-list", {
        sessionCode: normalizedCode,
        participants
      });
    } catch (error) {
      emitErrorOccurred(socket, "get-participants", "Unable to fetch participants.");
    }
  });

  socket.on("disconnect", async () => {
    try {
      const meta = socketMetaById.get(socket.id);
      if (!meta) {
        return;
      }

      const { role, sessionCode, studentName } = meta;

      if (role === "host") {
        const hostSocketId = hostSocketBySession.get(sessionCode);

        if (hostSocketId === socket.id) {
          hostSocketBySession.delete(sessionCode);
          io.to(sessionCode).emit("host-disconnected", {
            message: "Host disconnected. Quiz paused.",
            event: "disconnect"
          });
        }
      }

      if (role === "student") {
        const session = await Session.findOne({ sessionCode });

        if (session) {
          const originalCount = session.participants.length;
          session.participants = session.participants.filter(
            (participant) =>
              !(participant.socketId === socket.id || participant.name === studentName)
          );

          if (session.participants.length !== originalCount) {
            await session.save();
            io.to(sessionCode).emit("participant-left", {
              event: "disconnect",
              studentName,
              participants: session.participants.map((participant) => ({
                name: participant.name,
                socketId: participant.socketId,
                score: participant.score
              }))
            });
          }
        }
      }
    } catch (error) {
      // Cannot emit to a disconnected socket; log for server visibility.
      console.error("Disconnect handler error:", error.message);
    } finally {
      socketMetaById.delete(socket.id);
    }
  });
});

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGO_URI;

async function start() {
  if (!mongoUri) {
    console.error("MONGO_URI is not set. Add it to your environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }

  server.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

start();
