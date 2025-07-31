export function printMessage(message) {
  if (message.type === "transcript" && message.data.is_final) {
    const { text, start, end, language } = message.data.utterance;
    console.log(`${formatSeconds(start)} --> ${formatSeconds(end)} | ${language} | ${text.trim()}`);
  }
  else if (message.type === "post_final_transcript") {
    console.log();
    console.log("################ End of session ################");
    console.log();
    console.log(JSON.stringify(message.data, null, 2));
  }
}
function extractDurationFromDurationInMs(durationInMs) {
  if (!Number.isFinite(durationInMs) || durationInMs < 0) {
    throw new Error(`${durationInMs} isn't a valid duration`);
  }
  const milliseconds = Math.floor(durationInMs % 1000);
  let seconds = Math.floor(durationInMs / 1000);
  let minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  seconds = seconds % 60;
  minutes = minutes % 60;
  return {
    hours,
    minutes,
    seconds,
    milliseconds,
  };
}
function formatSeconds(duration) {
  if (duration == null ||
    Number.isNaN(duration) ||
    !Number.isFinite(duration)) {
    return "--:--.---";
  }
  const { hours, minutes, seconds, milliseconds } = extractDurationFromDurationInMs(duration * 1000);
  const fractions = [minutes, seconds];
  if (hours)
    fractions.unshift(hours);
  return [
    fractions.map((number) => number.toString().padStart(2, "0")).join(":"),
    milliseconds.toString().padStart(3, "0"),
  ].join(".");
}
export function getMicrophoneAudioFormat() {
  return {
    encoding: "wav/pcm",
    bit_depth: 16,
    sample_rate: 16000,
    channels: 1,
  };
}