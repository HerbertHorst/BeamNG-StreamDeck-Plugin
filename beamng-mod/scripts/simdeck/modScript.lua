-- Runs when BeamNG mounts the mod: load the SimDeck game engine extension
-- and keep it loaded across level changes.
load("simdeck")
setExtensionUnloadMode("simdeck", "manual")
