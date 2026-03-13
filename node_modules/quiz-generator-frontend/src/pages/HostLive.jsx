import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useParams } from "react-router-dom";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL;

export default function HostLive() {
	const { sessionCode: rawSessionCode } = useParams();
	const navigate = useNavigate();
	const socketRef = useRef(null);

	const sessionCode = useMemo(
		() => String(rawSessionCode || "").toUpperCase(),
		[rawSessionCode]
	);
	const joinUrl = `http://localhost:5173/join/${sessionCode}`;

	const [participants, setParticipants] = useState([]);
	const [isQuizStarted, setIsQuizStarted] = useState(false);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [currentQuestion, setCurrentQuestion] = useState(null);
	const [timeLeft, setTimeLeft] = useState(0);
	const [answeredStudents, setAnsweredStudents] = useState(() => new Set());
	const [errorMessage, setErrorMessage] = useState("");
	const [isConnectionLost, setIsConnectionLost] = useState(false);
	const [invalidSession, setInvalidSession] = useState(false);

	const allAnswered = participants.length > 0 && answeredStudents.size >= participants.length;
	const canGoNext = isQuizStarted && (!!currentQuestion ? timeLeft <= 0 || allAnswered : false);

	useEffect(() => {
		const socket = io(SOCKET_URL);
		socketRef.current = socket;

		socket.on("connect", () => {
			setIsConnectionLost(false);
			socket.emit("get-participants", { sessionCode });
		});

		socket.on("disconnect", () => {
			setIsConnectionLost(true);
		});

		socket.on("connect_error", () => {
			setIsConnectionLost(true);
		});

		socket.on("participants-list", (payload) => {
			const list = payload?.participants || [];
			setParticipants(list);
		});

		socket.on("quiz-started", (payload) => {
			setIsQuizStarted(true);
			setCurrentQuestionIndex(payload?.questionIndex ?? 0);
			setCurrentQuestion(payload?.question || null);
			setTimeLeft(payload?.question?.timeLimit || 0);
			setAnsweredStudents(new Set());
			setErrorMessage("");
		});

		socket.on("new-question", (payload) => {
			setCurrentQuestionIndex(payload?.questionIndex ?? 0);
			setCurrentQuestion(payload?.question || null);
			setTimeLeft(payload?.question?.timeLimit || 0);
			setAnsweredStudents(new Set());
		});

		socket.on("answer-received", (payload) => {
			const studentName = payload?.studentName;
			if (!studentName) {
				return;
			}

			setAnsweredStudents((prev) => {
				const next = new Set(prev);
				next.add(studentName);
				return next;
			});
		});

		socket.on("quiz-ended", (data) => {
			socket.emit("leaderboard-data", {
				sessionCode,
				leaderboard: data?.leaderboard || []
			});

			navigate(`/leaderboard/${sessionCode}?role=host`, {
				state: {
					role: "host",
					leaderboard: data
				}
			});
		});

		socket.on("join-error", (payload) => {
			setErrorMessage(payload?.message || "Something went wrong.");
		});

		socket.on("session-not-found", () => {
			setInvalidSession(true);
			setErrorMessage("Invalid session");
		});

		socket.on("error-occurred", (payload) => {
			setErrorMessage(payload?.message || "Something went wrong.");
		});

		const pollId = setInterval(() => {
			if (!isQuizStarted) {
				socket.emit("get-participants", { sessionCode });
			}
		}, 3000);

		return () => {
			clearInterval(pollId);
			socket.disconnect();
			socketRef.current = null;
		};
	}, [isQuizStarted, navigate, sessionCode]);

	if (invalidSession) {
		return (
			<main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
				<div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
					<h1 className="text-3xl font-bold text-rose-300">Invalid session</h1>
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="mt-6 rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
					>
						Back
					</button>
				</div>
			</main>
		);
	}

	useEffect(() => {
		if (!isQuizStarted || !currentQuestion || timeLeft <= 0) {
			return undefined;
		}

		const intervalId = setInterval(() => {
			setTimeLeft((prev) => {
				if (prev <= 1) {
					clearInterval(intervalId);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => {
			clearInterval(intervalId);
		};
	}, [currentQuestion, isQuizStarted, timeLeft]);

	function handleStartQuiz() {
		if (!socketRef.current) {
			return;
		}
		socketRef.current.emit("start-quiz", { sessionCode });
	}

	function handleNextQuestion() {
		if (!socketRef.current || !isQuizStarted) {
			return;
		}

		socketRef.current.emit("next-question", {
			sessionCode,
			questionIndex: currentQuestionIndex + 1
		});
	}

	function handleEndQuizEarly() {
		if (!socketRef.current) {
			return;
		}
		socketRef.current.emit("end-quiz", { sessionCode });
	}

	return (
		<main className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_42%)] px-4 py-10 text-slate-100 sm:px-8">
			<div className="mx-auto max-w-5xl rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur-sm sm:p-8">
				{isConnectionLost && (
					<p className="mb-4 rounded-lg border border-amber-400/35 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
						Connection lost, reconnecting...
					</p>
				)}
				{!isQuizStarted ? (
					<section className="space-y-6">
						<header className="space-y-2 text-center">
							<h1 className="text-3xl font-semibold">Session Lobby</h1>
							<p className="text-slate-400">Waiting for students to join...</p>
						</header>

						<div className="mx-auto w-fit rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-6 py-4 text-center">
							<p className="text-xs uppercase tracking-[0.2em] text-slate-400">Session Code</p>
							<p className="mt-1 text-4xl font-bold tracking-[0.25em] text-cyan-300">{sessionCode}</p>
						</div>

						<div className="mx-auto w-fit rounded-xl bg-white p-4">
							<QRCodeSVG value={joinUrl} size={200} />
						</div>

						<p className="break-all text-center text-sm text-slate-400">{joinUrl}</p>

						<section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
							<h2 className="mb-3 text-lg font-semibold">Joined Students ({participants.length})</h2>
							{participants.length === 0 ? (
								<p className="text-sm text-slate-400">No students joined yet.</p>
							) : (
								<ul className="grid gap-2 sm:grid-cols-2">
									{participants.map((participant) => (
										<li
											key={`${participant.name}-${participant.socketId}`}
											className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
										>
											{participant.name}
										</li>
									))}
								</ul>
							)}
						</section>

						<div className="flex justify-center">
							<button
								type="button"
								onClick={handleStartQuiz}
								className="rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
							>
								Start Quiz
							</button>
						</div>
					</section>
				) : (
					<section className="space-y-6">
						<header className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="text-sm uppercase tracking-[0.15em] text-slate-400">Live Question</p>
								<h1 className="text-2xl font-semibold">Question {currentQuestionIndex + 1}</h1>
							</div>
							<div className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-center">
								<p className="text-xs text-slate-400">Time Left</p>
								<p className="text-2xl font-bold text-cyan-300">{timeLeft}s</p>
							</div>
						</header>

						<article className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
							<p className="text-lg font-medium text-slate-100">
								{currentQuestion?.questionText || "Waiting for question data..."}
							</p>

							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								{(currentQuestion?.options || []).map((option, index) => (
									<div
										key={`readonly-option-${index}`}
										className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
									>
										<span className="mr-2 font-semibold text-slate-400">{String.fromCharCode(65 + index)}.</span>
										{option}
									</div>
								))}
							</div>
						</article>

						<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
							{answeredStudents.size} of {participants.length} students answered
						</div>

						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								onClick={handleNextQuestion}
								disabled={!canGoNext}
								className="rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-800"
							>
								Next Question
							</button>

							<button
								type="button"
								onClick={handleEndQuizEarly}
								className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-5 py-2.5 font-semibold text-rose-300 transition hover:bg-rose-500/20"
							>
								End Quiz Early
							</button>
						</div>
					</section>
				)}

				{errorMessage && (
					<p className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
						{errorMessage}
					</p>
				)}
			</div>
		</main>
	);
}
