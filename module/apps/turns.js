import { Helper } from "../helper.js";

export class Turns{
	static async _OnCombatTurn(combat, updates, options) {
		if (combat.turn > updates.turn && combat.round <= updates.round) {
			//Moving backwards in initiative
			return;
		}

		Turns.handleEndOfTurn(combat, updates);
		Turns.handleStartOfTurn(combat, updates);
	}

	static async _OnCombatRound(combat, updates, update) {
		if (combat.round > updates.round) {
			//Moving backwards in initiative
			return;
		}

		Turns.handleEndOfTurn(combat, updates);
		Turns.handleStartOfTurn(combat, updates);
	}

	static async handleEndOfTurn(combat, updates) {
		let currentTurnActor = combat.turns[combat.turn].actor;
		let currentTurnToken = combat.turns[combat.turn].token;
		//Remove all effects on all combatants that expire at the end of the current turn
		for(let turn of combat.turns) {			
			if (!turn.actor?.effects) {
				continue;
			}

			let toDelete = [];

			for (let effect of turn.actor.effects) {
				if (effect.flags.dnd4e?.effectData?.durationType == "endOfUserCurrent") {
					toDelete.push(effect.id);
					continue;
				}

				if (effect.duration.startRound == combat.round &&
					effect.duration.startTurn == combat.turn) {
					//This effect activated this turn and we don't want it to expire until next turn
					continue;
				}

				if (effect.flags.dnd4e?.effectData?.durationType == "endOfUserTurn" &&
					effect.flags.dnd4e?.effectData?.userTokenId == currentTurnToken.id) {
					toDelete.push(effect.id);
					continue;
				}

				if (effect.flags.dnd4e?.effectData?.durationType == "endOfTargetTurn" &&
					effect.flags.dnd4e?.effectData?.targetTokenId == currentTurnToken.id) {
					toDelete.push(effect.id);
					continue;
				}
			}
			
			await turn.actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
		}

		const endOfTurnEffects = currentTurnActor.effects.filter((e) => e.flags.dnd4e?.effectData?.durationType == "endOfUserTurn" ||
																		e.flags.dnd4e?.effectData?.durationType == "endOfTargetTurn");

		let toDelete = [];
		for (let effect of endOfTurnEffects) {
			if (effect.duration.startRound == combat.round &&
				effect.duration.startTurn == combat.turn) {
				//This effect activated this turn and we don't want it to expire until next turn
				continue;
			}

			if (effect.flags.dnd4e.effectData.durationType == "endOfUserTurn") {
				if (effect.flags.dnd4e.effectData.userTokenId) {
					if (combat.turns.find((c) => c.tokenId == effect.flags.dnd4e.effectData.userTokenId)) {
						//We have a user set and that user is still in the combat tracker
						continue;
					}
				}

				toDelete.push(effect.id);
				continue;
			}

			if (effect.flags.dnd4e.effectData.durationType == "endOfTargetTurn") {
				if (effect.flags.dnd4e.effectData.targetTokenId) {
					if (combat.turns.find((c) => c.tokenId == effect.flags.dnd4e.effectData.targetTokenId)) {
						//We have a target set and that target is still in the combat tracker
						continue;
					}
				}
				
				toDelete.push(effect.id);
				continue;
			}
		}
		
		if (toDelete.length) {
			await currentTurnActor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
		}

		function getActorOwner(actor) {
			let owner;
			let player;
			let gm;
			game.users.forEach((user) => {
				if (user.isGM) {
					gm = user;
				} else if (user.character?.id === actor.id) {
					owner = user;
				} else if (actor.getUserLevel(user) > 2) {
					player = user;
				}
			});
			return owner || player || gm;
		}

		let currentActorOwner = getActorOwner(currentTurnActor);

		if(currentActorOwner == game.user || !currentActorOwner.active){
			await currentTurnActor.promptEoTSavesSocket();
		} else {
			game.socket.emit('system.dnd4e', {
				operation: 'promptEoTSaves',
				tokenID: currentTurnToken.id,
				scene: combat.scene.id
			});
		}
	}

	static async handleStartOfTurn(combat, updates) {
		let newTurnActor = combat.turns[updates.turn].actor;
		let newTurnToken = combat.turns[updates.turn].token;
		for(let turn of combat.turns) {			
			if (!turn.actor?.effects) {
				continue;
			}

			let toDelete = [];

			for (let effect of turn.actor.effects) {
				if (effect.flags.dnd4e?.effectData?.durationType == "startOfUserTurn" &&
					effect.flags.dnd4e?.effectData?.userTokenId == newTurnToken.id) {
					toDelete.push(effect.id);
					continue;
				}

				if (effect.flags.dnd4e?.effectData?.durationType == "startOfTargetTurn" &&
					effect.flags.dnd4e?.effectData?.targetTokenId == newTurnToken.id) {
					toDelete.push(effect.id);
					continue;
				}
			}
			
			await turn.actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
		}

		const startOfTurnEffects = newTurnActor.effects.filter((e) => e.flags.dnd4e?.effectData?.durationType == "startOfUserTurn" ||
																	e.flags.dnd4e?.effectData?.durationType == "startOfTargetTurn");

		let toDelete = [];
		for (let effect of startOfTurnEffects) {
			if (effect.flags.dnd4e.effectData.durationType == "startOfUserTurn") {
				if (effect.flags.dnd4e.effectData.userTokenId) {
					if (combat.turns.find((c) => c.tokenId == effect.flags.dnd4e.effectData.userTokenId)) {
						//We have a user set and that user is still in the combat tracker
						continue;
					}
				}

				toDelete.push(effect.id);
				continue;
			}

			if (effect.flags.dnd4e.effectData.durationType == "startOfTargetTurn") {
				if (effect.flags.dnd4e.effectData.targetTokenId) {
					if (combat.turns.find((c) => c.tokenId == effect.flags.dnd4e.effectData.targetTokenId)) {
						//We have a target set and that target is still in the combat tracker
						continue;
					}
				}

				toDelete.push(effect.id);
				continue;
			}
		}
		
		if (toDelete.length) {
			await newTurnActor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
		}

		await newTurnActor.autoDoTsSocket(combat.turns[updates.turn].tokenId);
	}


	static async _onNextTurn(wrapped){
		const nextTurn = game.combat.turn + 1 < game.combat.turns.length? game.combat.turn + 1 : 0;
		const nextCombatant = game.combat.turns[nextTurn].token?.actor || null;		
		if(nextCombatant){
			//Triggers for the beginning of the next turn
			Helper.rechargeItems(nextCombatant, ["round"]);
		}
		
		return wrapped();
	}
}
