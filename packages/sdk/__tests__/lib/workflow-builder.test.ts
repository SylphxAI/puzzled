/**
 * Workflow Builder Tests
 *
 * Tests for the workflow builder DSL and step helpers.
 */

import { describe, expect, test } from "bun:test";
import type {
	JobStep,
	StepContext,
	WorkflowDefinition,
} from "../../src/lib/jobs/types";
import {
	WorkflowBuilder,
	conditional,
	createWorkflow,
	delay,
	fanOut,
	job,
	jobIf,
	loop,
	parallel,
	saga,
	sequence,
	sleepUntil,
	subworkflow,
	validateWorkflow,
	wait,
	withRetry,
	withTimeout,
} from "../../src/lib/jobs/workflow-builder";

// ============================================================================
// createWorkflow Tests
// ============================================================================

describe("createWorkflow", () => {
	describe("basic creation", () => {
		test("creates a workflow builder", () => {
			const builder = createWorkflow("test-workflow");
			expect(builder).toBeInstanceOf(WorkflowBuilder);
		});

		test("builds workflow with type", () => {
			const workflow = createWorkflow("user-onboarding").build();
			expect(workflow.type).toBe("user-onboarding");
		});
	});

	describe("fluent API", () => {
		test("sets name", () => {
			const workflow = createWorkflow("test").name("Test Workflow").build();
			expect(workflow.name).toBe("Test Workflow");
		});

		test("sets description", () => {
			const workflow = createWorkflow("test")
				.description("A test workflow")
				.build();
			expect(workflow.description).toBe("A test workflow");
		});

		test("sets defaults", () => {
			const workflow = createWorkflow("test")
				.defaults({ timeout: 30000, maxRetries: 3 })
				.build();
			expect(workflow.defaults).toEqual({ timeout: 30000, maxRetries: 3 });
		});

		test("adds single step", () => {
			const workflow = createWorkflow("test")
				.step("my-step", job("send-email"))
				.build();
			expect(workflow.steps.length).toBe(1);
			expect(workflow.steps[0].name).toBe("my-step");
		});

		test("adds multiple steps individually", () => {
			const workflow = createWorkflow("test")
				.step("step-1", job("job-1"))
				.step("step-2", job("job-2"))
				.step("step-3", job("job-3"))
				.build();
			expect(workflow.steps.length).toBe(3);
		});

		test("adds multiple steps at once", () => {
			const workflow = createWorkflow("test")
				.steps(
					["step-1", job("job-1")],
					["step-2", job("job-2")],
					["step-3", job("job-3")],
				)
				.build();
			expect(workflow.steps.length).toBe(3);
		});

		test("chaining returns same builder", () => {
			const builder = createWorkflow("test");
			expect(builder.name("Test")).toBe(builder);
			expect(builder.description("Desc")).toBe(builder);
			expect(builder.step("s", job("j"))).toBe(builder);
		});
	});

	describe("callbacks", () => {
		test("sets onComplete callback", () => {
			const callback = (result: unknown) => console.log(result);
			const workflow = createWorkflow("test").onComplete(callback).build();
			expect(workflow.onComplete).toBe(callback);
		});

		test("sets onError callback", () => {
			const callback = (error: Error, step: string) =>
				console.error(error, step);
			const workflow = createWorkflow("test").onError(callback).build();
			expect(workflow.onError).toBe(callback);
		});
	});
});

// ============================================================================
// job() Step Builder Tests
// ============================================================================

describe("job", () => {
	describe("basic job", () => {
		test("creates job step with type", () => {
			const step = job("send-email");
			expect(step.type).toBe("job");
			expect(step.jobType).toBe("send-email");
		});

		test("creates job step with static payload", () => {
			const step = job("send-email", { to: "user@test.com" });
			expect(step.payload).toBeInstanceOf(Function);
			expect(step.payload!({} as StepContext)).toEqual({ to: "user@test.com" });
		});

		test("creates job step with dynamic payload", () => {
			const step = job("send-email", (ctx) => ({
				to: ctx.input?.email || "default@test.com",
			}));
			expect(step.payload).toBeInstanceOf(Function);
		});

		test("creates job step with options", () => {
			const step = job("send-email", {}, { maxRetries: 5, timeout: 10000 });
			expect(step.options).toEqual({ maxRetries: 5, timeout: 10000 });
		});

		test("creates job step without payload", () => {
			const step = job("cleanup");
			expect(step.payload).toBeUndefined();
		});
	});
});

// ============================================================================
// conditional() Step Builder Tests
// ============================================================================

describe("conditional", () => {
	describe("basic conditional", () => {
		test("creates conditional step", () => {
			const step = conditional(
				(ctx) => ctx.input?.enabled === true,
				[job("enabled-job")],
				[job("disabled-job")],
			);
			expect(step.type).toBe("conditional");
		});

		test("has condition function", () => {
			const condition = (ctx: StepContext) => ctx.input?.test === true;
			const step = conditional(condition, [job("a")]);
			expect(step.condition).toBe(condition);
		});

		test("has then steps", () => {
			const thenSteps = [job("a"), job("b")];
			const step = conditional(() => true, thenSteps);
			expect(step.then).toBe(thenSteps);
		});

		test("has optional else steps", () => {
			const elseSteps = [job("fallback")];
			const step = conditional(() => false, [job("main")], elseSteps);
			expect(step.else).toBe(elseSteps);
		});

		test("else is undefined when not provided", () => {
			const step = conditional(() => true, [job("main")]);
			expect(step.else).toBeUndefined();
		});
	});
});

// ============================================================================
// parallel() Step Builder Tests
// ============================================================================

describe("parallel", () => {
	describe("basic parallel", () => {
		test("creates parallel step", () => {
			const step = parallel([job("a"), job("b")]);
			expect(step.type).toBe("parallel");
		});

		test("has steps array", () => {
			const steps = [job("a"), job("b"), job("c")];
			const step = parallel(steps);
			expect(step.steps).toBe(steps);
		});

		test("defaults to waitFor all", () => {
			const step = parallel([job("a")]);
			expect(step.waitFor).toBe("all");
		});

		test("can waitFor any", () => {
			const step = parallel([job("a")], { waitFor: "any" });
			expect(step.waitFor).toBe("any");
		});

		test("sets maxConcurrency", () => {
			const step = parallel([job("a")], { maxConcurrency: 5 });
			expect(step.maxConcurrency).toBe(5);
		});
	});
});

// ============================================================================
// loop() Step Builder Tests
// ============================================================================

describe("loop", () => {
	describe("basic loop", () => {
		test("creates loop step", () => {
			const step = loop([1, 2, 3], job("process"));
			expect(step.type).toBe("loop");
		});

		test("has static items", () => {
			const items = [1, 2, 3];
			const step = loop(items, job("process"));
			expect(step.items).toBe(items);
		});

		test("has dynamic items", () => {
			const itemsFn = (ctx: StepContext) => ctx.input?.items || [];
			const step = loop(itemsFn, job("process"));
			expect(step.items).toBe(itemsFn);
		});

		test("has step to execute", () => {
			const innerStep = job("process");
			const step = loop([1], innerStep);
			expect(step.step).toBe(innerStep);
		});

		test("sets maxConcurrency", () => {
			const step = loop([1], job("process"), { maxConcurrency: 3 });
			expect(step.maxConcurrency).toBe(3);
		});

		test("sets breakIf condition", () => {
			const breakIf = (item: unknown, index: number) => index > 5;
			const step = loop([1], job("process"), { breakIf });
			expect(step.breakIf).toBe(breakIf);
		});
	});
});

// ============================================================================
// wait() / delay() / sleepUntil() Tests
// ============================================================================

describe("wait", () => {
	describe("duration wait", () => {
		test("creates wait step with milliseconds", () => {
			const step = wait(5000);
			expect(step.type).toBe("wait");
			expect(step.until).toBe(5000);
		});

		test("creates wait step with Date", () => {
			const date = new Date("2025-01-01");
			const step = wait(date);
			expect(step.until).toBe(date);
		});

		test("creates wait step with dynamic value", () => {
			const fn = (ctx: StepContext) => ctx.input?.delayMs || 1000;
			const step = wait(fn);
			expect(step.until).toBe(fn);
		});
	});
});

describe("delay", () => {
	test("is alias for wait with milliseconds", () => {
		const step = delay(5000);
		expect(step.type).toBe("wait");
		expect(step.until).toBe(5000);
	});
});

describe("sleepUntil", () => {
	test("creates wait step with Date", () => {
		const date = new Date("2025-06-01");
		const step = sleepUntil(date);
		expect(step.type).toBe("wait");
		expect(step.until).toBe(date);
	});

	test("creates wait step with dynamic Date", () => {
		const fn = (ctx: StepContext) => new Date(ctx.input?.wakeTime);
		const step = sleepUntil(fn);
		expect(step.until).toBe(fn);
	});
});

// ============================================================================
// subworkflow() Step Builder Tests
// ============================================================================

describe("subworkflow", () => {
	describe("basic subworkflow", () => {
		test("creates subworkflow step", () => {
			const step = subworkflow("child-workflow");
			expect(step.type).toBe("subworkflow");
			expect(step.workflowType).toBe("child-workflow");
		});

		test("has static payload", () => {
			const step = subworkflow("child", { key: "value" });
			expect(step.payload!({} as StepContext)).toEqual({ key: "value" });
		});

		test("has dynamic payload", () => {
			const fn = (ctx: StepContext) => ctx.input || {};
			const step = subworkflow("child", fn);
			expect(step.payload).toBe(fn);
		});

		test("has options", () => {
			const step = subworkflow("child", {}, { timeout: 60000 });
			expect(step.options).toEqual({ timeout: 60000 });
		});
	});
});

// ============================================================================
// jobIf() Step Builder Tests
// ============================================================================

describe("jobIf", () => {
	test("creates job with condition", () => {
		const condition = (ctx: StepContext) => ctx.input?.enabled === true;
		const step = jobIf(condition, "conditional-job");
		expect(step.type).toBe("job");
		expect(step.if).toBe(condition);
	});

	test("inherits payload and options", () => {
		const step = jobIf(() => true, "job", { data: "test" }, { maxRetries: 3 });
		expect(step.payload!({} as StepContext)).toEqual({ data: "test" });
		expect(step.options).toEqual({ maxRetries: 3 });
	});
});

// ============================================================================
// withRetry() / withTimeout() Wrappers Tests
// ============================================================================

describe("withRetry", () => {
	test("adds retry options to job", () => {
		const originalJob = job("send-email");
		const retriedJob = withRetry(originalJob, { maxRetries: 5 });

		expect(retriedJob.options?.maxRetries).toBe(5);
	});

	test("adds retry delay", () => {
		const originalJob = job("send-email");
		const retriedJob = withRetry(originalJob, {
			maxRetries: 3,
			retryDelay: 1000,
		});

		expect(retriedJob.options?.retryDelay).toEqual({
			type: "fixed",
			delay: 1000,
		});
	});

	test("preserves existing options", () => {
		const originalJob = job("send-email", {}, { timeout: 5000 });
		const retriedJob = withRetry(originalJob, { maxRetries: 3 });

		expect(retriedJob.options?.timeout).toBe(5000);
		expect(retriedJob.options?.maxRetries).toBe(3);
	});
});

describe("withTimeout", () => {
	test("adds timeout to job", () => {
		const originalJob = job("long-running");
		const timedJob = withTimeout(originalJob, 30000);

		expect(timedJob.options?.timeout).toBe(30000);
	});

	test("preserves existing options", () => {
		const originalJob = job("send-email", {}, { maxRetries: 3 });
		const timedJob = withTimeout(originalJob, 10000);

		expect(timedJob.options?.maxRetries).toBe(3);
		expect(timedJob.options?.timeout).toBe(10000);
	});
});

// ============================================================================
// sequence() Tests
// ============================================================================

describe("sequence", () => {
	test("creates subworkflow steps from workflows", () => {
		const workflow1 = createWorkflow("workflow-1").build();
		const workflow2 = createWorkflow("workflow-2").build();

		const steps = sequence(workflow1, workflow2);

		expect(steps.length).toBe(2);
		expect(steps[0].type).toBe("subworkflow");
		expect(steps[1].type).toBe("subworkflow");
	});

	test("names steps with sequence index", () => {
		const workflow1 = createWorkflow("workflow-1").build();
		const workflow2 = createWorkflow("workflow-2").build();

		const steps = sequence(workflow1, workflow2);

		expect(steps[0].name).toBe("sequence-0-workflow-1");
		expect(steps[1].name).toBe("sequence-1-workflow-2");
	});
});

// ============================================================================
// fanOut() Tests
// ============================================================================

describe("fanOut", () => {
	test("creates loop step for items", () => {
		const items = ["a", "b", "c"];
		const step = fanOut(items, "process-item", (item) => ({ item }));

		expect(step.type).toBe("loop");
		expect(step.items).toBe(items);
	});

	test("sets maxConcurrency", () => {
		const step = fanOut([1, 2, 3], "process", () => ({}), {
			maxConcurrency: 5,
		});
		expect(step.maxConcurrency).toBe(5);
	});

	test("inner step is job type", () => {
		const step = fanOut([1], "process", () => ({}));
		expect(step.step.type).toBe("job");
	});
});

// ============================================================================
// saga() Tests
// ============================================================================

describe("saga", () => {
	test("creates forward steps from saga steps", () => {
		const sagaSteps = [
			{ forward: job("create-order"), compensate: job("cancel-order") },
			{ forward: job("charge-card"), compensate: job("refund-card") },
			{ forward: job("send-email"), compensate: job("send-cancellation") },
		];

		const steps = saga(sagaSteps);

		expect(steps.length).toBe(3);
	});

	test("names forward steps with index", () => {
		const sagaSteps = [
			{ forward: job("create-order"), compensate: job("cancel-order") },
			{ forward: job("charge-card"), compensate: job("refund-card") },
		];

		const steps = saga(sagaSteps) as JobStep[];

		expect(steps[0].name).toBe("saga-forward-0-create-order");
		expect(steps[1].name).toBe("saga-forward-1-charge-card");
	});

	test("forward steps have onComplete for tracking", () => {
		const sagaSteps = [
			{ forward: job("create-order"), compensate: job("cancel-order") },
		];

		const steps = saga(sagaSteps) as JobStep[];

		expect(steps[0].onComplete).toBeInstanceOf(Function);
	});
});

// ============================================================================
// validateWorkflow() Tests
// ============================================================================

describe("validateWorkflow", () => {
	describe("basic validation", () => {
		test("returns empty array for valid workflow", () => {
			const workflow = createWorkflow("test")
				.step("step-1", job("job-1"))
				.build();

			const errors = validateWorkflow(workflow);
			expect(errors).toEqual([]);
		});

		test("error for missing type", () => {
			const workflow = {
				steps: [job("test")],
			} as unknown as WorkflowDefinition;

			const errors = validateWorkflow(workflow);
			expect(errors).toContain("Workflow type is required");
		});

		test("error for no steps", () => {
			const workflow = createWorkflow("test").build();

			const errors = validateWorkflow(workflow);
			expect(errors).toContain("Workflow must have at least one step");
		});

		test("error for empty steps array", () => {
			const workflow = {
				type: "test",
				steps: [],
			} as unknown as WorkflowDefinition;

			const errors = validateWorkflow(workflow);
			expect(errors).toContain("Workflow must have at least one step");
		});
	});

	describe("duplicate step names", () => {
		test("error for duplicate step names", () => {
			const workflow = createWorkflow("test")
				.step("same-name", job("job-1"))
				.step("same-name", job("job-2"))
				.build();

			const errors = validateWorkflow(workflow);
			expect(errors).toContain("Duplicate step name: same-name");
		});

		test("no error for unique step names", () => {
			const workflow = createWorkflow("test")
				.step("step-1", job("job-1"))
				.step("step-2", job("job-2"))
				.build();

			const errors = validateWorkflow(workflow);
			expect(errors).not.toContain("Duplicate step name");
		});
	});

	describe("nested step validation", () => {
		test("checks conditional then steps", () => {
			const workflow: WorkflowDefinition = {
				type: "test",
				steps: [
					{
						type: "conditional",
						name: "cond",
						condition: () => true,
						then: [
							{ type: "job", name: "dup", jobType: "a" },
							{ type: "job", name: "dup", jobType: "b" },
						],
					},
				],
			};

			const errors = validateWorkflow(workflow);
			expect(errors).toContain("Duplicate step name: dup");
		});

		test("checks conditional else steps", () => {
			const workflow: WorkflowDefinition = {
				type: "test",
				steps: [
					{
						type: "conditional",
						name: "cond",
						condition: () => true,
						then: [{ type: "job", name: "ok", jobType: "a" }],
						else: [
							{ type: "job", name: "dup", jobType: "a" },
							{ type: "job", name: "dup", jobType: "b" },
						],
					},
				],
			};

			const errors = validateWorkflow(workflow);
			expect(errors).toContain("Duplicate step name: dup");
		});

		test("checks parallel steps", () => {
			const workflow: WorkflowDefinition = {
				type: "test",
				steps: [
					{
						type: "parallel",
						name: "par",
						steps: [
							{ type: "job", name: "dup", jobType: "a" },
							{ type: "job", name: "dup", jobType: "b" },
						],
						waitFor: "all",
					},
				],
			};

			const errors = validateWorkflow(workflow);
			expect(errors).toContain("Duplicate step name: dup");
		});

		test("checks loop step", () => {
			const workflow: WorkflowDefinition = {
				type: "test",
				steps: [
					{ type: "job", name: "outer", jobType: "a" },
					{
						type: "loop",
						name: "loop",
						items: [1, 2],
						step: { type: "job", name: "outer", jobType: "b" },
					},
				],
			};

			const errors = validateWorkflow(workflow);
			expect(errors).toContain("Duplicate step name: outer");
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("workflow builder integration", () => {
	test("complex onboarding workflow", () => {
		const workflow = createWorkflow("user-onboarding")
			.name("User Onboarding")
			.description("Complete user onboarding flow")
			.defaults({ maxRetries: 3, timeout: 60000 })
			.step(
				"create-account",
				job("create-user", (ctx) => ({
					email: ctx.input?.email,
					name: ctx.input?.name,
				})),
			)
			.step(
				"send-welcome",
				job("send-email", (ctx) => ({
					to: ctx.results?.["create-account"]?.email,
					template: "welcome",
				})),
			)
			.step("wait-verification", wait(24 * 60 * 60 * 1000))
			.step(
				"check-verified",
				conditional(
					(ctx) => ctx.results?.["create-account"]?.verified === true,
					[job("activate-account")],
					[job("send-reminder")],
				),
			)
			.build();

		expect(workflow.type).toBe("user-onboarding");
		expect(workflow.name).toBe("User Onboarding");
		expect(workflow.steps.length).toBe(4);
		expect(validateWorkflow(workflow)).toEqual([]);
	});

	test("parallel processing workflow", () => {
		const workflow = createWorkflow("batch-process")
			.step("split", job("prepare-batch"))
			.step(
				"process",
				parallel(
					[
						job("process-images"),
						job("process-videos"),
						job("process-documents"),
					],
					{ maxConcurrency: 3 },
				),
			)
			.step("merge", job("combine-results"))
			.build();

		expect(workflow.steps.length).toBe(3);
		expect(workflow.steps[1].type).toBe("parallel");
		expect(validateWorkflow(workflow)).toEqual([]);
	});

	test("saga pattern workflow", () => {
		const orderSaga = saga([
			{
				forward: job("create-order"),
				compensate: job("cancel-order"),
			},
			{
				forward: job("reserve-inventory"),
				compensate: job("release-inventory"),
			},
			{
				forward: job("charge-payment"),
				compensate: job("refund-payment"),
			},
			{
				forward: job("ship-order"),
				compensate: job("cancel-shipment"),
			},
		]);

		const workflow = createWorkflow("order-process")
			.steps(
				...orderSaga.map(
					(step, i) => [`step-${i}`, step] as [string, typeof step],
				),
			)
			.build();

		expect(workflow.steps.length).toBe(4);
	});
});
