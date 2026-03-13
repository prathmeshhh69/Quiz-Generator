import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

function PodiumCard({ rank, player }) {
	const stylesByRank = {
		1: {
			wrapper: "border-yellow-300/70 bg-yellow-400/15",
			pillar: "h-40 bg-gradient-to-t from-yellow-700 to-yellow-300",
			text: "text-yellow-200",
			badge: "bg-yellow-300 text-yellow-900",
			icon: "Crown"
		},
		2: {
			wrapper: "border-slate-300/70 bg-slate-300/10",
			pillar: "h-28 bg-gradient-to-t from-slate-600 to-slate-300",
			text: "text-slate-100",
			badge: "bg-slate-300 text-slate-900",
			icon: "2nd"
		},
		3: {
			wrapper: "border-amber-500/70 bg-amber-500/10",
			pillar: "h-20 bg-gradient-to-t from-amber-800 to-amber-400",
			text: "text-amber-200",
			badge: "bg-amber-400 text-amber-900",
			icon: "3rd"
		}
	};

	const style = stylesByRank[rank];

	return (
		<div className={`flex flex-1 flex-col items-center rounded-xl border px-3 py-4 ${style.wrapper}`}>
			<div className={`mb-3 rounded-full px-3 py-1 text-xs font-bold ${style.badge}`}>
				{rank === 1 ? "Crown" : style.icon}
			</div>
			<p className={`text-sm font-semibold ${style.text}`}>{player?.name || "-"}</p>
			<p className="mt-1 text-xs text-slate-300">{player ? `${player.score} pts` : "No score"}</p>
			<div className={`mt-4 w-full rounded-md ${style.pillar}`} />
		</div>
	);
}

export default function Leaderboard() {
	const { sessionCode: rawSessionCode } = useParams();
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const navigate = useNavigate();

	const sessionCode = useMemo(
		() => String(rawSessionCode || "").toUpperCase(),
		[rawSessionCode]
	);
	const roleFromQuery = String(searchParams.get("role") || "").toLowerCase();
	const stateRole = String(location.state?.role || "").toLowerCase();
	const role = stateRole || roleFromQuery || "student";
	const isHostView = role === "host";

	const stateLeaderboardSource = location.state?.leaderboard;
	const stateParticipants = Array.isArray(stateLeaderboardSource)
		? stateLeaderboardSource
		: Array.isArray(stateLeaderboardSource?.participants)
			? stateLeaderboardSource.participants
			: Array.isArray(stateLeaderboardSource?.leaderboard)
				? stateLeaderboardSource.leaderboard
				: [];

	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState("");
	const [invalidSession, setInvalidSession] = useState(false);
	const [rankings, setRankings] = useState(
		stateParticipants.map((participant) => ({
			name: participant.name,
			score: Number(participant.score || 0)
		}))
	);
	const [totalQuestions, setTotalQuestions] = useState(
		Number(stateLeaderboardSource?.totalQuestions || 0)
	);
	const [averageScore, setAverageScore] = useState(
		Number(stateLeaderboardSource?.averageScore || 0)
	);

	useEffect(() => {
		let isMounted = true;

		async function fetchLeaderboard() {
			setIsLoading(true);
			setErrorMessage("");
			setInvalidSession(false);

			try {
				const response = await axios.get(`${API_BASE_URL}/api/session/${sessionCode}/leaderboard`);
				if (!isMounted) {
					return;
				}

				const participants = Array.isArray(response.data?.participants)
					? response.data.participants
					: Array.isArray(response.data?.leaderboard)
						? response.data.leaderboard
						: [];

				setRankings(participants);
				setTotalQuestions(Number(response.data?.totalQuestions || 0));

				const computedAverage = participants.length
					? Math.round(participants.reduce((sum, item) => sum + Number(item.score || 0), 0) / participants.length)
					: 0;
				setAverageScore(Number(response.data?.averageScore ?? computedAverage));
			} catch (error) {
				if (isMounted) {
					if (error.response?.status === 404) {
						setInvalidSession(true);
						setErrorMessage("Invalid session");
					} else {
						setErrorMessage(error.response?.data?.message || "Unable to load leaderboard.");
					}
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		if (sessionCode) {
			fetchLeaderboard();
		}

		return () => {
			isMounted = false;
		};
	}, [sessionCode]);

	const studentName = useMemo(() => localStorage.getItem("studentName") || "", []);
	const personalRank = useMemo(() => {
		if (!studentName || rankings.length === 0) {
			return null;
		}

		const index = rankings.findIndex((participant) => participant.name === studentName);
		if (index < 0) {
			return null;
		}

		return {
			rank: index + 1,
			name: rankings[index].name,
			score: rankings[index].score
		};
	}, [rankings, studentName]);

	const finalScore = Number(location.state?.finalScore) || personalRank?.score || 0;

	const first = rankings[0] || null;
	const second = rankings[1] || null;
	const third = rankings[2] || null;
	const others = rankings.slice(3);

	if (invalidSession) {
		return (
			<main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
				<div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/35 bg-rose-500/10 p-6 text-center">
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

	return (
		<main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_32%),radial-gradient(circle_at_bottom,_rgba(34,211,238,0.2),_transparent_35%)]" />

			<div className="pointer-events-none absolute inset-0">
				{Array.from({ length: 24 }).map((_, index) => (
					<span
						key={`confetti-${index}`}
						className="confetti-piece"
						style={{
							left: `${(index + 1) * 4}%`,
							animationDelay: `${(index % 6) * 0.25}s`
						}}
					/>
				))}
			</div>

			<div className="relative mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-[0_30px_90px_-35px_rgba(250,204,21,0.45)] backdrop-blur-sm sm:p-8">
				<header className="text-center">
					<h1 className="leaderboard-title text-4xl font-black tracking-wide text-yellow-300 sm:text-5xl">
						🏆 Final Leaderboard
					</h1>
					<p className="mt-3 text-lg font-semibold text-slate-200">
						{isHostView ? "Quiz Complete! Great hosting. Here are the final results." : "Final scores are in."}
					</p>
					<p className="mt-3 text-sm uppercase tracking-[0.2em] text-cyan-300">Session {sessionCode}</p>
				</header>

				{isLoading ? (
					<div className="mt-10 flex items-center justify-center gap-2 text-slate-300">
						<span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-yellow-300" />
						<span>Loading leaderboard...</span>
					</div>
				) : errorMessage ? (
					<p className="mt-10 rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-center text-rose-300">
						{errorMessage}
					</p>
				) : (
					<>
							{!isHostView && personalRank && (
						<section className="mt-8 rounded-2xl border-2 border-yellow-400/60 bg-yellow-400/10 p-5 text-center shadow-[0_0_28px_-6px_rgba(250,204,21,0.35)]">
							<p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">Your Result 🎯</p>
							<p className="mt-3 text-xl font-black text-white sm:text-2xl">
								You scored{" "}
								<span className="text-yellow-300">{finalScore} pts</span>
								{" "}—{" "}Rank{" "}
								<span className="text-yellow-300">#{personalRank.rank}</span>
								{" "}out of{" "}
								<span className="text-yellow-300">{rankings.length}</span>
								{" "}students 🎯
							</p>
					</section>
					)}

					<section className="mt-8 rounded-2xl border border-slate-700 bg-slate-950/55 p-5">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
							<span>Total Questions: <strong className="text-slate-100">{totalQuestions}</strong></span>
							<span>Average Score: <strong className="text-slate-100">{averageScore}</strong></span>
						</div>

						<div className="flex items-end gap-3">
							<PodiumCard rank={2} player={second} />
								<PodiumCard rank={3} player={third} />
							</div>
						</section>

						<section className="mt-8 rounded-2xl border border-slate-700 bg-slate-950/55 p-5">
								<h2 className="mb-3 text-xl font-semibold text-slate-100">
									{isHostView ? "All Participants" : "More Rankings"}
								</h2>

							{others.length === 0 ? (
								<p className="text-sm text-slate-400">No additional participants beyond top 3.</p>
							) : (
								<ul className="space-y-2">
									{others.map((participant, index) => {
										const rank = index + 4;
										const isMe = !isHostView && participant.name === studentName;
										return (
											<li
												key={`${participant.name}-${rank}`}
												className={`flex items-center justify-between rounded-lg border px-4 py-2 ${
													isMe
														? "border-yellow-400/70 bg-yellow-400/10 ring-1 ring-yellow-400/40"
														: "border-slate-700 bg-slate-900"
												}`}
											>
												<div className="flex items-center gap-3">
													<span className={`w-8 text-sm font-bold ${isMe ? "text-yellow-300" : "text-cyan-300"}`}>#{rank}</span>
													<span className={`font-medium ${isMe ? "text-yellow-100" : "text-slate-100"}`}>{participant.name}</span>
													{isMe && <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs font-semibold text-yellow-300">You</span>}
												</div>
												<span className={`text-sm font-semibold ${isMe ? "text-yellow-200" : "text-slate-200"}`}>{participant.score} pts</span>
											</li>
										);
									})}
								</ul>
							)}
						</section>
					</>
				)}

				<div className="mt-8 flex justify-center">
					{isHostView ? (
						<button
							type="button"
							onClick={() => navigate("/")}
							className="rounded-lg bg-gradient-to-r from-cyan-400 to-yellow-300 px-6 py-2.5 font-bold text-slate-900 transition hover:brightness-110"
						>
							Create New Quiz
						</button>
					) : (
						<p className="text-lg font-semibold text-emerald-200">Thanks for playing! 🎉</p>
					)}
				</div>
			</div>

			<style>{`
				.leaderboard-title {
					animation: pulseGlow 1.8s ease-in-out infinite;
				}

				.confetti-piece {
					position: absolute;
					top: -12px;
					width: 8px;
					height: 14px;
					border-radius: 2px;
					background: linear-gradient(180deg, #facc15, #22d3ee);
					opacity: 0.8;
					animation: confettiFall 4s linear infinite;
				}

				@keyframes confettiFall {
					0% {
						transform: translateY(-10px) rotate(0deg);
						opacity: 0;
					}
					10% {
						opacity: 0.95;
					}
					100% {
						transform: translateY(110vh) rotate(360deg);
						opacity: 0;
					}
				}

				@keyframes pulseGlow {
					0%, 100% {
						text-shadow: 0 0 10px rgba(250, 204, 21, 0.6), 0 0 30px rgba(250, 204, 21, 0.25);
					}
					50% {
						text-shadow: 0 0 16px rgba(250, 204, 21, 0.95), 0 0 42px rgba(56, 189, 248, 0.45);
					}
				}
			`}</style>
		</main>
	);
}
