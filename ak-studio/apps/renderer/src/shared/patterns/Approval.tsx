// Approval: the approval pattern over a job's open request (architecture.md, Jobs; P1b design gate row (a)). It reads
// the job's `request` and answers only through `job.respond` (respondToJob). The frame follows the signed-off rule:
// a card where the work happens, a modal (ConfirmModal) when the request is confirm-by-name or its approve option is
// destructive (real infrastructure, or something destroyed). The buttons' labels are the request's options' labels
// (they say what happens); approve is the option `approve` (CONFIRM_OPTION_IDS), deny the option `deny`. A request
// with other options takes its first as approve and its last as deny (the choice and permission kinds settle their
// own layout when first used: P6, P8). For confirm-by-name, approve sends the typed name and enables only on an exact
// match; deny never sends it (job.respond accepts deny without the name). A destructive approve always comes with
// a name to type: the runtime refuses `destructive` without `expectedName` (JobContext.confirm).
//
// Answering: the pressed button shows pending after 300 ms (the shared timing); a refused answer is shown inline in
// the frame (the modal stays open), by the error catalogue's title. Once answered, the card shows the outcome in
// place ("Approved by you", "Denied") for as long as it is mounted; the modal closes. A job stopped while it waited
// was not denied by the person, so it shows no outcome. Escape and the modal's deny button answer deny.
import {
	CONFIRM_OPTION_IDS,
	type Job,
	type UserRequest,
} from "@ak-studio/contract";
import { ApprovalCard, ConfirmModal, uiStrings } from "@ak-studio/ui";
import { useRef, useState } from "react";
import { respondToJob } from "../jobs/jobStore";
import { usePendingAfter } from "../query/pending";
import { type ErrorSlots, failureOf, presentError } from "./presentError";

type Option = NonNullable<UserRequest["options"]>[number];
type Which = "approve" | "deny";

export type ApprovalFrame = "card" | "modal";

/** The frame the signed-off rule gives a request: a modal for confirm-by-name or a destructive approve. */
export function approvalFrame(request: UserRequest): ApprovalFrame {
	const destructive = request.options?.some((option) => option.destructive);
	return request.kind === "confirm-by-name" || destructive ? "modal" : "card";
}

/** The request's approve and deny options (defaults when it has none). */
export function approvalOptions(request: UserRequest): {
	approve: Option;
	deny: Option;
} {
	const options = request.options ?? [];
	const byId = (id: string) => options.find((option) => option.id === id);
	return {
		approve: byId(CONFIRM_OPTION_IDS.approve) ??
			options[0] ?? {
				id: CONFIRM_OPTION_IDS.approve,
				label: uiStrings.approval.approve,
			},
		deny: byId(CONFIRM_OPTION_IDS.deny) ??
			(options.length > 1 ? options.at(-1) : undefined) ?? {
				id: CONFIRM_OPTION_IDS.deny,
				label: uiStrings.approval.deny,
			},
	};
}

export interface ApprovalProps {
	/** The job whose open request this answers. */
	job: Job;
	/** Overrides the rule's frame (a view that is itself the place of the work, say). */
	frame?: ApprovalFrame;
}

/** An answer, sent or taken, with what the card needs to show it once the request has gone. */
interface Answer {
	requestId: string;
	which: Which;
	frame: ApprovalFrame;
	title: string;
	summary: string;
}

export function Approval({ job, frame }: ApprovalProps) {
	const request = job.request;
	const [answered, setAnswered] = useState<Answer>();
	const [inFlight, setInFlight] = useState<Answer>();
	const [refused, setRefused] = useState<{
		requestId: string;
		error: ErrorSlots;
	}>();
	const sending = useRef(false);
	const late = usePendingAfter(inFlight !== undefined, inFlight);

	if (!request) {
		// Answered by the person: the outcome stays in place (card frame), as the same card (focus stays on it).
		// The job's event that removes the request comes before the reply to job.respond, so an answer still in
		// flight counts too (cleared if the reply refuses it). Stopped while waiting: nothing.
		const shown = answered ?? inFlight;
		if (shown?.frame !== "card") return null;
		return (
			<ApprovalCard
				key={shown.requestId}
				title={shown.title}
				summary={shown.summary}
				outcome={shown.which === "approve" ? "approved" : "denied"}
				onApprove={() => {}}
				onDeny={() => {}}
			/>
		);
	}

	const { approve, deny } = approvalOptions(request);
	const shownFrame = frame ?? approvalFrame(request);
	const isAnswered = answered?.requestId === request.id;
	const pending =
		late && inFlight?.requestId === request.id ? inFlight.which : undefined;
	const error = refused?.requestId === request.id ? refused.error : undefined;

	const answer = (which: Which, typedName?: string) => {
		if (sending.current) return;
		sending.current = true;
		const target: Answer = {
			requestId: request.id,
			which,
			frame: shownFrame,
			title: request.title,
			summary: request.summary,
		};
		setInFlight(target);
		setRefused(undefined);
		const option = which === "approve" ? approve : deny;
		respondToJob({
			jobId: job.id,
			requestId: request.id,
			answer: {
				optionId: option.id,
				...(which === "approve" && typedName !== undefined
					? { name: typedName }
					: {}),
			},
		})
			.then(
				() => setAnswered(target),
				(reason: unknown) =>
					setRefused({
						requestId: request.id,
						error: presentError(failureOf(reason)),
					}),
			)
			.finally(() => {
				sending.current = false;
				setInFlight(undefined);
			});
	};

	if (shownFrame === "modal") {
		const common = {
			isOpen: !isAnswered,
			onOpenChange: () => {},
			title: request.title,
			confirmLabel: approve.label,
			strings: { cancel: deny.label },
			pending:
				pending === "approve"
					? ("confirm" as const)
					: pending === "deny"
						? ("cancel" as const)
						: undefined,
			error,
			onConfirm: (typedName?: string) => answer("approve", typedName),
			// Escape and the deny button: deny, unless an answer is already on its way.
			onCancel: () => answer("deny"),
			children: request.summary,
		};
		const affects = request.affects.length > 0 ? request.affects : undefined;
		const name = request.expectedName || undefined;
		return approve.destructive && name ? (
			<ConfirmModal
				{...common}
				variant="destructive"
				affects={request.affects}
				confirmName={name}
			/>
		) : (
			<ConfirmModal {...common} affects={affects} confirmName={name} />
		);
	}

	return (
		<ApprovalCard
			key={request.id}
			title={request.title}
			summary={request.summary}
			affects={request.affects}
			approveLabel={approve.label}
			denyLabel={deny.label}
			destructive={approve.destructive === true}
			confirmName={request.expectedName}
			pending={pending}
			error={error}
			outcome={
				isAnswered
					? answered?.which === "approve"
						? "approved"
						: "denied"
					: undefined
			}
			onApprove={(typedName) => answer("approve", typedName)}
			onDeny={() => answer("deny")}
		/>
	);
}
