    const DEFAULTS = {
      maxToolAttemptsPerTurn: 64, maxProgressToolCallsPerTurn: 16, progressToolNames: ['todo_write'],
      maxCallsPerRepeatGroup: 5, strictTools: [], strictToolLimit: 3, blockExactDuplicates: true,
      dryRunMode: false, assistantOutputGuard: true, maxRepeatedAssistantLines: 5,
      maxRepeatedAssistantBlocks: 5, maxAssistantBlockChars: 16384, pseudoToolCallThreshold: 3,
      oscillationDetection: true, maxOscillationRepeats: 3, payloadBloatGuard: true, maxToolResultChars: 65536,
      errorThrashingGuard: true, maxConsecutiveFailures: 4, adaptiveSteering: true,
    };

    const CLIENT_PRESETS = {
      strict: {
        maxToolAttemptsPerTurn: 10, maxProgressToolCallsPerTurn: 3, maxCallsPerRepeatGroup: 2,
        strictToolLimit: 1, blockExactDuplicates: true, oscillationDetection: true, maxOscillationRepeats: 2,
        errorThrashingGuard: true, maxConsecutiveFailures: 3, payloadBloatGuard: true, maxToolResultChars: 32768,
        pseudoToolCallThreshold: 2, adaptiveSteering: true,
      },
      balanced: {
        maxToolAttemptsPerTurn: 16, maxProgressToolCallsPerTurn: 6, maxCallsPerRepeatGroup: 3,
        strictToolLimit: 2, blockExactDuplicates: true, oscillationDetection: true, maxOscillationRepeats: 3,
        errorThrashingGuard: true, maxConsecutiveFailures: 4, payloadBloatGuard: true, maxToolResultChars: 65536,
        pseudoToolCallThreshold: 3, adaptiveSteering: true,
      },
      autonomous: {
        maxToolAttemptsPerTurn: 32, maxProgressToolCallsPerTurn: 12, maxCallsPerRepeatGroup: 5,
        strictToolLimit: 3, blockExactDuplicates: true, oscillationDetection: true, maxOscillationRepeats: 4,
        errorThrashingGuard: true, maxConsecutiveFailures: 6, payloadBloatGuard: true, maxToolResultChars: 131072,
        pseudoToolCallThreshold: 4, adaptiveSteering: true,
      },
    };
