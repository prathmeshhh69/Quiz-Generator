import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const TIME_LIMIT_OPTIONS = [10, 15, 20, 30];
const OPTION_LABELS = ["A", "B", "C", "D"];

function createEmptyQuestion() {
	return {
		questionText: "",
		options: ["", "", "", ""],
		correctIndex: null,
		timeLimit: 20
	};
}

export default function HostDashboard() {
	const navigate = useNavigate();
	const qrContainerRef = useRef(null);

	const [title, setTitle] = useState("");
	const [hostName, setHostName] = useState("");
	const [questions, setQuestions] = useState([createEmptyQuestion()]);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [createdSessionCode, setCreatedSessionCode] = useState("");
	const [isHostVerified, setIsHostVerified] = useState(false);
	const [isCheckingHostVerified, setIsCheckingHostVerified] = useState(true);
	const [hostPassword, setHostPassword] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

	useEffect(() => {
		const verified = localStorage.getItem("hostVerified") === "true";
		setIsHostVerified(verified);
		setIsCheckingHostVerified(false);
	}, []);

	const joinUrl = useMemo(() => {
		if (!createdSessionCode) {
			return "";
		}

		return `http://localhost:5173/join/${createdSessionCode}`;
	}, [createdSessionCode]);

	function addQuestion() {
		setQuestions((current) => [...current, createEmptyQuestion()]);
	}

	function deleteQuestion(questionIndex) {
		setQuestions((current) => current.filter((_, index) => index !== questionIndex));
	}

	function updateQuestionText(questionIndex, value) {
		setQuestions((current) =>
			current.map((question, index) =>
				index === questionIndex ? { ...question, questionText: value } : question
			)
		);
	}

	function updateOption(questionIndex, optionIndex, value) {
		setQuestions((current) =>
			current.map((question, index) => {
				if (index !== questionIndex) {
					return question;
				}

				const nextOptions = [...question.options];
				nextOptions[optionIndex] = value;
				return { ...question, options: nextOptions };
			})
		);
	}

	function setCorrectOption(questionIndex, optionIndex) {
		setQuestions((current) =>
			current.map((question, index) =>
				index === questionIndex ? { ...question, correctIndex: optionIndex } : question
			)
		);
	}

	function updateTimeLimit(questionIndex, value) {
		const parsedValue = Number(value);
		setQuestions((current) =>
			current.map((question, index) =>
				index === questionIndex ? { ...question, timeLimit: parsedValue } : question
			)
		);
	}

	function validateQuiz() {
		if (!title.trim()) {
			return "Quiz title is required.";
		}

		if (!hostName.trim()) {
			return "Host name is required.";
		}

		if (questions.length === 0) {
			return "Add at least one question.";
		}

		for (let index = 0; index < questions.length; index += 1) {
			const question = questions[index];

			if (!question.questionText.trim()) {
				return `Question ${index + 1} text is required.`;
			}

			if (question.options.some((option) => !option.trim())) {
				return `Question ${index + 1} needs all 4 options.`;
			}

			if (question.correctIndex === null || question.correctIndex < 0 || question.correctIndex > 3) {
				return `Question ${index + 1} needs a correct option.`;
			}
		}

		return "";
	}

	async function handleSaveQuiz() {
		const validationError = validateQuiz();
		setErrorMessage(validationError);

		if (validationError) {
			return;
		}

		setIsSaving(true);

		try {
			const payload = {
				title: title.trim(),
				createdBy: hostName.trim(),
				questions: questions.map((question) => ({
					questionText: question.questionText.trim(),
					options: question.options.map((option) => option.trim()),
					correctIndex: question.correctIndex,
					timeLimit: question.timeLimit
				}))
			};

			const response = await axios.post(`${API_BASE_URL}/api/quiz/create`, payload);
			localStorage.setItem("isHost", "true");
			setCreatedSessionCode(response.data.sessionCode);
			setErrorMessage("");
		} catch (error) {
			const apiMessage = error.response?.data?.message;
			setErrorMessage(apiMessage || "Failed to save quiz. Please try again.");
		} finally {
			setIsSaving(false);
		}
	}

	function closeModal() {
		setCreatedSessionCode("");
	}

	function downloadQrCode() {
		const svgElement = qrContainerRef.current?.querySelector("svg");

		if (!svgElement || !createdSessionCode) {
			return;
		}

		const serializer = new XMLSerializer();
		const source = serializer.serializeToString(svgElement);
		const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
		const objectUrl = URL.createObjectURL(blob);

		const link = document.createElement("a");
		link.href = objectUrl;
		link.download = `session-${createdSessionCode}-qr.svg`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(objectUrl);
	}

	function goToHostPanel() {
		if (!createdSessionCode) {
			return;
		}

		navigate(`/host/${createdSessionCode}`);
	}

	async function handleVerifyHostPassword(event) {
		event.preventDefault();

		if (!hostPassword.trim()) {
			setPasswordError("Incorrect password");
			setHostPassword("");
			return;
		}

		try {
			setIsVerifyingPassword(true);
			setPasswordError("");

			const response = await axios.post(`${API_BASE_URL}/api/host/verify-password`, {
				password: hostPassword
			});

			if (response.data?.success) {
				localStorage.setItem("hostVerified", "true");
				localStorage.setItem("isHost", "true");
				setIsHostVerified(true);
				setHostPassword("");
				return;
			}

			setPasswordError("Incorrect password");
			setHostPassword("");
		} catch (error) {
			if (error.response?.status === 401) {
				setPasswordError("Incorrect password");
			} else {
				setPasswordError("Unable to verify password right now. Ensure backend is running on port 5000.");
			}
			setHostPassword("");
		} finally {
			setIsVerifyingPassword(false);
		}
	}

	if (isCheckingHostVerified) {
		return (
			<main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
				<div className="flex items-center gap-2 text-slate-300">
					<span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-cyan-500" />
					<span>Loading...</span>
				</div>
			</main>
		);
	}

	if (!isHostVerified) {
		return (
			<main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
				<div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/30">
					<h1 className="text-center text-2xl font-bold text-slate-100">Enter Host Password</h1>

					<form onSubmit={handleVerifyHostPassword} className="mt-5 space-y-3">
						<input
							type="password"
							value={hostPassword}
							onChange={(event) => setHostPassword(event.target.value)}
							placeholder="Enter password"
							className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
						/>

						{passwordError && (
							<p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
								{passwordError}
							</p>
						)}

						<button
							type="submit"
							disabled={isVerifyingPassword}
							className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-700"
						>
							{isVerifyingPassword ? "Verifying..." : "Verify"}
						</button>
					</form>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.16),_transparent_42%)] px-4 py-10 text-slate-100 sm:px-8">
			<div className="mx-auto max-w-5xl rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-sm sm:p-8">
				<header className="mb-6 flex flex-col gap-2">
					<h1 className="text-3xl font-semibold tracking-tight text-slate-100">Host Dashboard</h1>
					<p className="text-slate-400">Build your quiz, choose correct answers, and launch the live session.</p>
				</header>

				<section className="grid gap-4 md:grid-cols-2">
					<label className="space-y-2">
						<span className="text-sm font-medium text-slate-300">Quiz title</span>
						<input
							type="text"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Enter quiz title"
							className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
						/>
					</label>

					<label className="space-y-2">
						<span className="text-sm font-medium text-slate-300">Host name</span>
						<input
							type="text"
							value={hostName}
							onChange={(event) => setHostName(event.target.value)}
							placeholder="Enter host name"
							className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
						/>
					</label>
				</section>

				<div className="mt-6">
					<button
						type="button"
						onClick={addQuestion}
						className="rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
					>
						Add Question
					</button>
				</div>

				<section className="mt-6 space-y-4">
					{questions.map((question, questionIndex) => (
						<article
							key={`question-${questionIndex}`}
							className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/40"
						>
							<div className="mb-4 flex items-center justify-between gap-3">
								<h2 className="text-lg font-semibold text-slate-200">Question {questionIndex + 1}</h2>
								<button
									type="button"
									onClick={() => deleteQuestion(questionIndex)}
									className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
								>
									Delete Question
								</button>
							</div>

							<label className="space-y-2">
								<span className="text-sm text-slate-300">Question text</span>
								<input
									type="text"
									value={question.questionText}
									onChange={(event) => updateQuestionText(questionIndex, event.target.value)}
									placeholder="Type question"
									className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
								/>
							</label>

							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								{question.options.map((option, optionIndex) => {
									const isSelected = question.correctIndex === optionIndex;

									return (
										<label
											key={`option-${questionIndex}-${optionIndex}`}
											className={`rounded-lg border px-3 py-2 transition ${
												isSelected
													? "border-emerald-400 bg-emerald-500/10"
													: "border-slate-700 bg-slate-900"
											}`}
										>
											<div className="mb-2 flex items-center gap-2">
												<span className="text-xs font-semibold tracking-wide text-slate-300">
													Option {OPTION_LABELS[optionIndex]}
												</span>
												<input
													type="radio"
													name={`correct-option-${questionIndex}`}
													checked={isSelected}
													onChange={() => setCorrectOption(questionIndex, optionIndex)}
													className="h-4 w-4 accent-emerald-500"
												/>
												<span className="text-xs text-slate-400">Correct answer</span>
											</div>

											<input
												type="text"
												value={option}
												onChange={(event) =>
													updateOption(questionIndex, optionIndex, event.target.value)
												}
												placeholder={`Enter option ${OPTION_LABELS[optionIndex]}`}
												className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
											/>
										</label>
									);
								})}
							</div>

							<label className="mt-4 inline-flex items-center gap-3 text-sm text-slate-300">
								<span>Time limit</span>
								<select
									value={question.timeLimit}
									onChange={(event) => updateTimeLimit(questionIndex, event.target.value)}
									className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 outline-none focus:border-cyan-400"
								>
									{TIME_LIMIT_OPTIONS.map((seconds) => (
										<option key={seconds} value={seconds}>
											{seconds} seconds
										</option>
									))}
								</select>
							</label>
						</article>
					))}
				</section>

				{errorMessage && (
					<p className="mt-5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
						{errorMessage}
					</p>
				)}

				<div className="mt-8">
					<button
						type="button"
						onClick={handleSaveQuiz}
						disabled={isSaving}
						className="rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-700"
					>
						{isSaving ? "Saving..." : "Save Quiz"}
					</button>
				</div>
			</div>

			{createdSessionCode && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
					<div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
						<h3 className="text-xl font-semibold text-slate-100">Quiz Created</h3>
						<p className="mt-2 text-sm text-slate-400">Share this session code with players.</p>

						<div className="mt-4 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-center">
							<span className="text-4xl font-bold tracking-[0.2em] text-cyan-300">{createdSessionCode}</span>
						</div>

						<div ref={qrContainerRef} className="mt-5 flex justify-center rounded-lg bg-white p-4">
							<QRCodeSVG value={joinUrl} size={220} />
						</div>

						<p className="mt-3 break-all text-center text-xs text-slate-400">{joinUrl}</p>

						<div className="mt-5 grid gap-2">
							<button
								type="button"
								onClick={downloadQrCode}
								className="rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-4 py-2 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
							>
								Download QR Code
							</button>
							<button
								type="button"
								onClick={goToHostPanel}
								className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400"
							>
								Go to Host Panel
							</button>
							<button
								type="button"
								onClick={closeModal}
								className="rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-300 transition hover:bg-slate-800"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
