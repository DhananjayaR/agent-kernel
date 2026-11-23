# Design finalisation process

Every phase that adds or changes a screen passes a **design gate** before its UI is built. This file defines
the gate once; each phase doc lists only its screens, the questions to settle and its sign-off record.

## Ground rules

- **Requirements are fixed, designs are not.** What the user must be able to do comes from
  [issue #950](https://github.com/yaalalabs/agent-kernel/issues/950). The gate does not reopen those
  requirements. It decides how the screen delivers them.
- **Existing designs are input, not a contract.** The briefs (00 to 09) and the Claude Design canvas on
  `feature/950-agent-kernel-studio-phase-1` are unapproved. Use them as a starting sketch. Keep what works,
  change what does not, and do not spend time defending or attacking them.
- **Good UX is a deliverable.** A screen is not done because it matches an artboard. It is done when it passes
  the checklist below.
- **Design in the real components.** Final designs are built in Storybook from the Studio's own component
  library (see [P1a](P1a-app-foundation.md)), with fixture data, so the approved design and the shipped screen
  are the same code. The Claude Design canvas stays useful for exploring layout options quickly.

## The gate, step by step

| Step | What happens | Output |
|---|---|---|
| 1. Requirements | List what the user must be able to do on the screen, from the issue. One line each. | Requirement list in the phase doc |
| 2. Review the sketch | Compare the existing brief and artboards to the list. Mark each requirement covered, partly covered or missing. Note anything drawn that no requirement asks for. | Gap notes |
| 3. Explore | Where the layout or flow is contested, produce two or three options (static is enough). Otherwise go to step 4. | Options, one picked with a reason |
| 4. Prototype | Build the screen in Storybook with the real components and fixture data: the main state and every state in the checklist. | Stories |
| 5. Review | Walk the prototype against the checklist. Fix and repeat. | Checklist ticked |
| 6. Sign-off | The design owner approves. Record the date, the approver and any decisions in the phase doc and in the README decision log. | Sign-off line |

Build work for the screen starts after step 6. Non-UI work in the same phase (services, bridge, tests) does not
wait for the gate.

## UX checklist (every screen)

- [ ] **Job is clear.** A new user can say what the screen is for and what to do first.
- [ ] **All states exist:** empty, loading, error, and the "cannot read this project" state where it applies.
- [ ] **Version states exist:** a feature the project's Agent Kernel version lacks is shown as unavailable with
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
- [ ] **Copy is final:** sentence case, Agent Kernel's own vocabulary, no placeholder text.
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

- **Brand drift.** The briefs and the canvas's design-system tokens use electric blue `#00DDFF` as primary,
  magenta `#F200FF` for the coding agent, a near-black ground and Inter for body text. The repository's
  current tokens (`docs/src/css/custom.css`, after the OAK rebrand) use orange `#FF5E32` as primary, a navy
  ground and Archivo for body text. P1a's design gate settles the Studio palette and fonts.
- **Fonts are loaded from Google Fonts** on the canvas. The app makes no network calls of its own, so fonts
  are bundled.
- **Second-pass artboards are not drawn** (listed in the feature branch README).
- **The canvas was never rendered and checked** at 1440 and 1100 px (the feature branch README says so).
- **No version states.** No brief mentions the project's Agent Kernel version; the designs assume one.
- **Six deploy targets are assumed.** Azure Functions is being retired
  (`docs/specs/957-retire-azure-functions/design.md`), so the list depends on the project's version.
