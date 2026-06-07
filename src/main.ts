/** Composition root: constructs concrete implementations and wires them into the
 *  controller. This is the only place that knows about concrete classes — every
 *  module otherwise depends on the interfaces in lib/types.ts. */

import './style.css';

import { initThemeToggle } from './ui/theme';
import { showAlert } from './ui/alerts';
import { byId } from './lib/dom';

import { AppState } from './app/AppState';
import { RecorderController } from './app/RecorderController';

import { AudioCapture } from './audio/AudioCapture';
import { PitchDetector } from './audio/PitchDetector';
import { PitchStabilizer } from './audio/PitchStabilizer';
import { VolumeMeter } from './audio/VolumeMeter';
import { GenderAnalyzer } from './audio/GenderAnalyzer';
import { FormantAnalyzer } from './audio/FormantAnalyzer';
import { encodeToMp3 } from './audio/Mp3Encoder';
import { IndexedDbRecordingStore } from './storage/RecordingStore';

import { RecorderView } from './ui/RecorderView';
import { RecordingsList } from './ui/RecordingsList';
import { Palette } from './ui/graphs/palette';
import { PitchGraph } from './ui/graphs/PitchGraph';
import { VolumeGraph } from './ui/graphs/VolumeGraph';
import { GenderGauge } from './ui/graphs/GenderGauge';

function bootstrap(): void {
  initThemeToggle();

  const palette = new Palette();
  const capture = new AudioCapture();
  const view = new RecorderView();

  // `list` and `controller` reference each other; the handlers defer to the
  // controller, which is constructed immediately after. Explicit annotations
  // break the type-inference cycle.
  const list: RecordingsList = new RecordingsList({
    onDownload: (id) => controller.download(id),
    onDelete: (id) => controller.remove(id),
  });

  const controller: RecorderController = new RecorderController({
    capture,
    pitch: new PitchDetector(capture.fftSize),
    stabilizer: new PitchStabilizer(),
    volume: new VolumeMeter(),
    gender: new GenderAnalyzer(),
    formant: new FormantAnalyzer(),
    store: new IndexedDbRecordingStore(),
    encodeMp3: encodeToMp3,
    state: new AppState(),
    view,
    pitchGraph: new PitchGraph(byId<HTMLCanvasElement>('pitch-canvas'), palette),
    volumeGraph: new VolumeGraph(byId<HTMLCanvasElement>('volume-canvas'), palette),
    gauge: new GenderGauge(),
    list,
    notify: showAlert,
  });

  view.setState('idle');
  view.resetLive();
  void controller.init();
}

bootstrap();
