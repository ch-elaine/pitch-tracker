/** Composition root: wires UI modules together. Business/audio logic is added
 *  in later milestones (see .claude/skills/* playbooks) — for now this boots the
 *  shell and a placeholder recording timer so the UI is verifiable. */

import './style.css';
import { initThemeToggle } from './ui/theme';
import { showAlert } from './ui/alerts';
import { RecorderView, type RecorderState } from './ui/RecorderView';

function bootstrap(): void {
  initThemeToggle();

  // --- Placeholder recorder wiring -----------------------------------------
  // TODO(audio): replace this stub with RecorderController once AudioCapture,
  // PitchDetector, and VolumeMeter land. It only exercises the view's states.
  let state: RecorderState = 'idle';
  let timer: number | undefined;
  let startedAt = 0;

  const view = new RecorderView(() => {
    if (state === 'idle') {
      state = 'recording';
      startedAt = performance.now();
      view.setState('recording');
      timer = window.setInterval(() => view.updateTime(performance.now() - startedAt), 200);
      showAlert('Audio capture is not wired up yet — this is the UI shell.', 'info');
    } else {
      state = 'idle';
      view.setState('idle');
      if (timer) window.clearInterval(timer);
      view.resetLive();
    }
  });

  view.setState('idle');
  view.resetLive();
}

bootstrap();
