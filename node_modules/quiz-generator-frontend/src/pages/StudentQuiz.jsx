import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate, useParams } from "react-router-dom";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL;
const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_STYLES = [
	"from-sky-500 to-cyan-500",
	"from-violet-500 to-fuchsia-500",
	"from-amber-500 to-orange-500",
	"from-emerald-500 to-teal-500"
];

export default function StudentQuiz() {
	const { sessionCode: rawSessionCode } = useParams();
	const navigate = useNavigate();
	const socketRef = useRef(null);
	const questionStartTimeRef = useRef(null);
	const totalScoreRef = useRef(0);

	const sessionCode = useMemo(
		() => String(rawSessionCode || "").toUpperCase(),
		[rawSessionCode]
	);
	const studentName = useMemo(() => localStorage.getItem("studentName") || "", []);

	const [phase, setPhase] = useState("waiting");
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [currentQuestion, setCurrentQuestion] = useState(null);
	const [selectedOption, setSelectedOption] = useState(null);
	const [totalScore, setTotalScore] = useState(0);
	const [scoreFlash, setScoreFlash] = useState(null);
	const [feedback, setFeedback] = useState(null);
	const [errorMessage, setErrorMessage] = useState("");
	const [timeLeft, setTimeLeft] = useState(0);
	const [timeLimit, setTimeLimit] = useState(0);
	const [isConnectionLost, setIsConnectionLost] = useState(false);
	const [invalidSession, setInvalidSession] = useState(false);

	useEffect(() => {
		if (!studentName) {
			navigate(`/join/${sessionCode}`, { replace: true });
			return undefined;
		}

		const socket = io(SOCKET_URL);
		socketRef.current = socket;

		function handleQuestion(payload) {
			const question = payload?.question || null;
			const limit = Number(question?.timeLimit) || 20;

			setCurrentQuestionIndex(payload?.questionIndex ?? 0);
			setCurrentQuestion(question);
			setSelectedOption(null);
			setFeedback(null);
			setPhase("question");
			setTimeLimit(limit);
			setTimeLeft(limit);
			questionStartTimeRef.current = Date.now();
		}

		socket.on("connect", () => {
			setIsConnectionLost(false);
			socket.emit("join-session", { sessionCode, studentName });
		});

		socket.on("disconnect", () => {
			setIsConnectionLost(true);
		});

		socket.on("connect_error", () => {
			setIsConnectionLost(true);
		});

		socket.on("quiz-started", handleQuestion);
		socket.on("new-question", handleQuestion);

		socket.on("answer-received", (payload) => {
			const isCorrect = Boolean(payload?.isCorrect);
			const awardedScore = Number(payload?.awardedScore || 0);
			const nextTotal = Number(payload?.totalScore || 0);

			totalScoreRef.current = nextTotal;
			setTotalScore(nextTotal);
			setScoreFlash(isCorrect ? "correct" : "wrong");
			window.setTimeout(() => setScoreFlash(null), 800);
			setFeedback({
				isCorrect,
				awardedScore,
				correctIndex: payload?.correctIndex
			});
			setPhase("feedback");

			window.setTimeout(() => {
				setFeedback(null);
				setPhase("waiting");
			}, 1500);
		});

		socket.on("quiz-ended", (payload) => {
			const leaderboard = Array.isArray(payload?.leaderboard) ? payload.leaderboard : [];
			const rankIndex = leaderboard.findIndex((entry) => entry?.name === studentName);
			const finalRank = rankIndex >= 0 ? rankIndex + 1 : null;
			const finalScore = leaderboard.find((e) => e?.name === studentName)?.score ?? totalScoreRef.current;

			setPhase("end");
			window.setTimeout(() => {
				navigate(`/leaderboard/${sessionCode}?role=student`, {
					state: {
						role: "student",
						studentName,
						finalScore,
						finalRank
					}
				});
			}, 900);
		});

		socket.on("join-error", (payload) => {
			setErrorMessage(payload?.message || "Unable to connect to session.");
		});

		socket.on("session-not-found", () => {
			setInvalidSession(true);
			setErrorMessage("Invalid session");
		});

		socket.on("error-occurred", (payload) => {
			setErrorMessage(payload?.message || "Unable to connect to session.");
		});

		return () => {
			socket.disconnect();
			socketRef.current = null;
		};
	}, [navigate, sessionCode, studentName]);

	if (invalidSession) {
		return (
			<main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
				<div className="mx-auto max-w-3xl rounded-3xl border border-rose-400/35 bg-rose-500/10 p-6 text-center">
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
		if (phase !== "question" || timeLeft <= 0) {
			return undefined;
		}

		const intervalId = window.setInterval(() => {
			setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
		}, 1000);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [phase, timeLeft]);

	function submitAnswer(optionIndex) {
		if (!socketRef.current || phase !== "question" || selectedOption !== null) {
			return;
		}

		setSelectedOption(optionIndex);

		const startTime = questionStartTimeRef.current || Date.now();
		const elapsedSeconds = Math.max(0, Math.round((Date.now() - startTime) / 100) / 10);

		socketRef.current.emit("submit-answer", {
			sessionCode,
			studentName,
			questionIndex: currentQuestionIndex,
			selectedOption: optionIndex,
			timeTaken: elapsedSeconds
		});
	}

	const progressPercent = timeLimit > 0 ? Math.max(0, (timeLeft / timeLimit) * 100) : 0;
	const timerColor = timeLeft < 5 ? "bg-rose-500" : "bg-emerald-400";

	return (
		<main className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.22),_transparent_45%)] px-4 py-8 text-slate-100 sm:px-6">
			<div className="mx-auto max-w-3xl rounded-3xl border border-slate-700/70 bg-slate-900/85 p-6 shadow-[0_24px_80px_-28px_rgba(6,182,212,0.45)] backdrop-blur-sm sm:p-8">
				{isConnectionLost && (
					<p className="mb-4 rounded-lg border border-amber-400/35 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
						Connection lost, reconnecting...
					</p>
				)}
<div
				className={`mb-5 flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-300 ${
					scoreFlash === "correct"
						? "border-emerald-400/60 bg-emerald-500/20"
						: scoreFlash === "wrong"
						? "border-rose-400/60 bg-rose-500/20"
						: "border-amber-300/30 bg-amber-400/10"
				}`}
			>
				<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Your Score</p>
				<p
					className={`text-2xl font-black transition-colors duration-300 ${
						scoreFlash === "correct"
							? "text-emerald-300"
							: scoreFlash === "wrong"
							? "text-rose-300"
							: "text-amber-300"
					}`}
				>
					{totalScore} pts
				</p>
			</div>

			<header className="mb-6 flex items-center justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Session {sessionCode}</p>
					<h1 className="mt-1 text-2xl font-black uppercase tracking-wide text-amber-300">Quiz Arena</h1>
				</div>
				<div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-right">
					<p className="text-xs text-slate-300">Player</p>
					<p className="text-sm font-semibold text-cyan-200">{studentName || "Guest"}</p>
				</div>
			</header>

				{phase === "waiting" && (
					<section className="rounded-2xl border border-slate-700 bg-slate-950/60 p-6 text-center">
						<p className="text-xl font-semibold text-slate-200">Waiting for host to start</p>
						<div className="mt-3 flex justify-center gap-2">
							<span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.2s]" />
							<span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.1s]" />
							<span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-200" />
						</div>
					</section>
				)}

				{phase === "question" && currentQuestion && (
					<section className="space-y-5">
						<div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
							<p className="text-xs uppercase tracking-[0.15em] text-slate-400">Question {currentQuestionIndex + 1}</p>
							<h2 className="mt-2 text-2xl font-bold text-white">{currentQuestion.questionText}</h2>
						</div>

						<div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
							<div className="mb-2 flex items-center justify-between text-sm text-slate-300">
								<span>Timer</span>
								<span className={timeLeft < 5 ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>
									{timeLeft}s
								</span>
							</div>
							<div className="h-3 overflow-hidden rounded-full bg-slate-800">
								<div
									className={`h-full transition-all duration-300 ${timerColor}`}
									style={{ width: `${progressPercent}%` }}
								/>
							</div>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							{(currentQuestion.options || []).slice(0, 4).map((option, index) => {
								const isPicked = selectedOption === index;
								return (
									<button
										key={`student-option-${index}`}
										type="button"
										disabled={selectedOption !== null || timeLeft <= 0}
										onClick={() => submitAnswer(index)}
										className={`rounded-xl border px-4 py-3 text-left font-semibold text-white transition ${
											isPicked
												? "border-emerald-300 bg-emerald-500/30 ring-2 ring-emerald-300"
												: "border-transparent"
										} ${
											selectedOption !== null || timeLeft <= 0
												? "cursor-not-allowed opacity-70"
												: "hover:brightness-110"
										} bg-gradient-to-br ${OPTION_STYLES[index]}`}
									>
										<span className="mr-2 rounded-md bg-black/20 px-2 py-1 text-xs">{OPTION_LABELS[index]}</span>
										{option}
									</button>
								);
							})}
						</div>
					</section>
				)}

				{phase === "feedback" && feedback && (
					<section className="rounded-2xl border border-slate-700 bg-slate-950/70 p-6 text-center">
						{feedback.isCorrect ? (
							<p className="text-2xl font-black text-emerald-300">Correct! +{feedback.awardedScore} points</p>
						) : (
							<p className="text-2xl font-black text-rose-300">
								Wrong! The answer was {OPTION_LABELS[Number(feedback.correctIndex ?? 0)]}
							</p>
						)}
						<p className="mt-2 text-slate-300">Current total: {totalScore}</p>
					</section>
				)}

				{phase === "end" && (
					<section className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-6 text-center">
						<p className="text-2xl font-black text-indigo-200">Quiz finished! See the leaderboard on the host screen</p>
					</section>
				)}

				{errorMessage && (
					<p className="mt-6 rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
						{errorMessage}
					</p>
				)}
			</div>
		</main>
	);
}
