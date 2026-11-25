# Design finalisation process

Every phase that adds or changes a screen passes a **design gate** before its UI is built. This file defines
the gate once; each phase doc lists only its screens, the questions to settle and its sign-off record.

## Ground rules

- **Requirements are fixed, designs are not.** What the user must be able to do comes from the team's
  [Phase 1 PRD](../PHASE-1-PRD.md) (revised 25 November 2026), which
  supersedes [issue #950](https://github.com/yaalalabs/agent-kernel/issues/950) where they differ, and from
  the screen's brief. The gate does not reopen those requirements. It decides how the screen delivers them.
- **Existing designs are input, not a contract.** The briefs (00 to 09) in the spec folder
  ([README](../README.md#phase-1-files)) and the
  Claude Design canvas are input. Use them as a starting sketch. Keep what works, change what does not, and
  do not spend time defending or attacking them.
- **Where the design lives: the Claude Design "OAK Studio Phases"** (<https://claude.ai/artifact/HxwXUwENoUhpnjKdQb1k8j>), our copy of the
  team's canvas of 25 November 2026. Each phase doc's header names its artboards in a **Claude Design** row.
  Step 2 reviews those artboards; step 3 draws its options on new artboards beside them, on the same page, named
  `<Artboard>-Option-A`, `-B` and so on; after sign-off the chosen option replaces the artboard, so the canvas
  shows what was approved, phase by phase. The copy is private until its owner shares it.
- **A signed-off story supersedes its artboard.** Artboard and component names stay the code names where they
  fit. After each gate, the team gets the list of differences, so the canvas can follow: the PRD lists the
  redrawn canvas as a team deliverable. Who owns it is
  [open decision 11](../README.md#open-decisions).
- **Good UX is a deliverable.** A screen is not done because it matches an artboard. It is done when it passes
  the checklist below.
- **Design in the real components.** Final designs are built in Storybook from the Studio's own component
  library (see [P1a](P1a-app-foundation.md)), with fixture data, so the approved design and the shipped screen
  are the same code. The Claude Design canvas stays useful for exploring layout options quickly.

## The gate, step by step

| Step | What happens | Output |
|---|---|---|
| 1. Requirements | List what the user must be able to do on the screen, from the PRD and the screen's brief. One line each. | Requirement list in the phase doc |
| 2. Review the sketch | Compare the existing brief and the phase's artboards in the Claude Design to the list. Mark each requirement covered, partly covered or missing. Note anything drawn that no requirement asks for. | Gap notes |
| 3. Explore | Where the layout or flow is contested, draw two or three options as artboards in the Claude Design (static is enough). Otherwise go to step 4. | Options, one picked with a reason |
| 4. Prototype | Build the screen in Storybook with the real components and fixture data: the main state and every state in the checklist. | Stories |
| 5. Review | Walk the prototype against the checklist. Fix and repeat. | Checklist ticked |
| 6. Sign-off | The design owner approves. Record the date, the approver and any decisions in the phase doc and in the README decision log. | Sign-off line |

Build work for the screen starts after step 6. Non-UI work in the same phase (services, bridge, tests) does not
wait for the gate.

## UX checklist (every screen)

- [ ] **Job is clear.** A new user can say what the screen is for and what to do first.
- [ ] **All states exist:** empty, loading, error, and the "cannot read this project" state where it applies.
- [ ] **Version states exist:** a feature the project's Open Agent Kernel version lacks is shown as unavailable with
      the version that adds it, never as a broken control (see [P2](P2-project-and-kernel-version.md)).
- [ ] **Holds at 1100 px wide** and is comfortable at 1440 px. No horizontal scrolling of the page.
- [ ] **Keyboard works.** Every action is reachable; focus order follows reading order; focus is visible.
      Composite widgets (canvas, tree, table, trace) follow their written keyboard model.
- [ ] **Built from the pattern catalogue** in [conventions-and-skills.md](conventions-and-skills.md). A new
      pattern is added to the catalogue first.
- [ ] **Nothing is lost silently:** unsaved work is guarded; a change on disk is shown.
- [ ] **Contrast** is 4.5:1 for text, in the dark and the light theme.
- [ ] **State is never colour alone:** an icon or dot plus a label.
- [ ] **The app's standing promises are visible** where they apply: files are the source of truth, every
      command is shown, real infrastructure needs an explicit yes, secrets are names only.
- [ ] **Copy is final:** sentence case, the vocabulary and name rule of Open Agent Kernel (OAK), no placeholder text.
- [ ] **Slow and failed operations are designed:** progress for anything over one second, a way to cancel long
      commands, an error that says what to do next.
- [ ] **Motion respects** the reduced-motion setting.

## Sign-off record format

Each phase doc carries a table like this, one row per screen:

| Screen | Options explored | Decision | Approved by | Date |
|---|---|---|---|---|
| Welcome | 2 | Recent projects left, toolchain right | _name_ | _date_ |

## Known gaps in the existing design input

Recorded so nobody rediscovers them:

- **Style reference.** The Studio's basic style resembles React Spectrum (Spectrum 2) in size, density and
  states. Where the brand is explicit it wins: rectangular buttons, inputs and tags at the 8 px control
  radius, Tabler outline icons, OAK's colours ([branding](../../../../branding/README.md)). Where a brief's
  styling differs, the Studio's tokens win; the brief's layout and content still apply.
- **The team's styling assumptions.** The briefs and canvas were moved to the OAK identity on 25 November
  2026, with orange primary and solid floating layers, as ours. Three assumptions still differ from our
  approved gate: 40 px controls (ours 32 px), Archivo for all UI text (ours Inter, with Archivo for headings
  and primary call-to-action labels) and light when the system gives no answer (ours dark). See
  [open decision 10](../README.md#open-decisions).
- **The coding agent's name in copy.** The briefs label it "Claude Code". The Studio's feature is "Claude
  Agent" ([conventions-and-skills.md](conventions-and-skills.md#copy-rules)); "Claude Code" names only the
  user's installed program.
- **Fonts are loaded from Google Fonts** on the canvas. The app makes no network calls of its own, so fonts
  are bundled.
- **Second-pass artboards are not drawn** (listed in the README's [artboard map](../README.md#design-canvas)).
- **The redrawn canvas is not reviewed.** The README's [design canvas](../README.md#design-canvas) section
  says the re-skin of 25 November was not rendered and checked.
- **No version states.** No brief mentions the project's OAK version; the designs assume one.
- **Five deploy targets.** The PRD names five; Azure Functions is retired
  (`docs/specs/957-retire-azure-functions/design.md`). The catalog decides what a project's version offers.
