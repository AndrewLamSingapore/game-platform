const COMPETITIVE_FORBIDDEN=new Set(['LLM','EXTERNAL_MODEL','NARRATIVE_NPC','GAME_MASTER']);
export function assertCompetitiveDependency(component){if(COMPETITIVE_FORBIDDEN.has(component))throw new Error(`competitive_hot_path_forbids_${component.toLowerCase()}`);return true;}
export function routeSubsystem(mode){return ['NARRATIVE','RPG'].includes(mode)?'NARRATIVE_AI':'COMPETITIVE_RUNTIME';}
