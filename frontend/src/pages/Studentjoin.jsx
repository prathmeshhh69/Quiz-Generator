import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export default function StudentJoin() {
	const { sessionCode: rawSessionCode } = useParams();
	const navigate = useNavigate();
	const socketRef = useRef(null);

	const sessionCode = String(rawSessionCode || "").toUpperCase();

	const [quizTitle, setQuizTitle] = useState("Loading quiz...");
	const [studentName, setStudentName] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [isJoining, setIsJoining] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [invalidSession, setInvalidSession] = useState(false);
	const [isConnectionLost, setIsConnectionLost] = useState(false);

	useEffect(() => {
		let isMounted = true;

		async function fetchQuiz() {
			try {
				setIsLoading(true);
				const response = await axios.get(`${API_BASE_URL}/api/quiz/${sessionCode}`);
				if (isMounted) {
					setQuizTitle(response.data?.title || "Quiz");
					setInvalidSession(false);
				}
			} catch (error) {
				if (isMounted) {
					if (error.response?.status === 404) {
						setInvalidSession(true);
						setErrorMessage("Invalid session");
					} else {
						setQuizTitle("Unknown Quiz");
						setErrorMessage("Unable to load quiz details.");
					}
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		if (sessionCode) {
			fetchQuiz();
		}

		return () => {
			isMounted = false;
		};
	}, [sessionCode]);

	useEffect(() => {
		return () => {
			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
			}
		};
	}, []);

	function handleJoinQuiz() {
		const normalizedName = studentName.trim();

		if (!normalizedName) {
			setErrorMessage("Name is required before joining.");
			return;
		}

		setErrorMessage("");
		setIsJoining(true);

		if (socketRef.current) {
			socketRef.current.disconnect();
			socketRef.current = null;
		}

		const socket = io(API_BASE_URL);
		socketRef.current = socket;

		socket.on("connect", () => {
			setIsConnectionLost(false);
			socket.emit("join-session", {
				sessionCode,
				studentName: normalizedName
			});
		});

		socket.on("disconnect", () => {
			setIsConnectionLost(true);
		});

		socket.on("connect_error", () => {
			setIsConnectionLost(true);
		});

		socket.on("joined-success", (payload) => {
			if (payload?.status === "active" || payload?.status === "finished") {
				setErrorMessage("Quiz already started or ended");
				setIsJoining(false);
				socket.disconnect();
				socketRef.current = null;
				return;
			}

			localStorage.setItem("isHost", "false");
			localStorage.setItem("studentName", normalizedName);
			setIsJoining(false);
			navigate(`/quiz/${sessionCode}`);
		});

		socket.on("join-error", (payload) => {
			setErrorMessage(payload?.message || "Unable to join this session.");
			setIsJoining(false);
		});

		socket.on("error-occurred", (payload) => {
			setErrorMessage(payload?.message || "Unable to join this session.");
			setIsJoining(false);
		});
	}

	if (invalidSession) {
		return (
			<main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-rose-100 px-4 py-10 text-slate-800 sm:px-6">
				<div className="mx-auto max-w-xl rounded-2xl border border-rose-300 bg-white/90 p-6 text-center shadow-xl shadow-orange-200/40">
					<h1 className="text-3xl font-bold text-rose-700">Invalid session</h1>
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="mt-6 rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-white transition hover:bg-orange-600"
					>
						Back
					</button>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-rose-100 px-4 py-10 text-slate-800 sm:px-6">
			<div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white/90 p-6 shadow-xl shadow-orange-200/40 backdrop-blur-sm sm:p-8">
				{isConnectionLost && (
					<p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
						Connection lost, reconnecting...
					</p>
				)}
				<p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">Welcome</p>
				<h1 className="mt-2 text-3xl font-bold text-slate-900">Join Quiz Session</h1>
				{isLoading ? (
					<div className="mt-4 flex items-center gap-2 text-slate-700">
						<span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
						<span>Loading quiz...</span>
					</div>
				) : (
					<p className="mt-3 text-lg text-slate-700">
						Joining: <span className="font-semibold text-slate-900">{quizTitle}</span>
					</p>
				)}

				<div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
					<p className="text-xs uppercase tracking-[0.15em] text-orange-600">Session Code</p>
					<p className="mt-1 text-2xl font-bold tracking-[0.2em] text-orange-700">{sessionCode}</p>
				</div>

				<label className="mt-6 block space-y-2">
					<span className="text-sm font-medium text-slate-700">Your Name</span>
					<input
						type="text"
						value={studentName}
						onChange={(event) => setStudentName(event.target.value.slice(0, 20))}
						maxLength={20}
						placeholder="Enter your name"
						className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-orange-400"
					/>
					<p className="text-xs text-slate-500">Max 20 characters</p>
				</label>

				{errorMessage && (
					<p className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
						{errorMessage}
					</p>
				)}

				<button
					type="button"
					onClick={handleJoinQuiz}
					disabled={isJoining}
					className="mt-6 w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
				>
					{isJoining ? "Joining..." : "Join Quiz"}
				</button>
			</div>
		</main>
	);
}
