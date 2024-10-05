import ActorSheet4e from "./actor-sheet.js"

export default class ActorSheet4eNPC extends ActorSheet4e {



	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["dnd4e", "sheet", "actor", "NPC"],
			width: 600,
			height: 680
		});
	}
	/** @override */
	get template() {
		if ( !game.user.isGM && this.actor.limited ) return `systems/dnd4e/templates/npc-sheet-limited.html`;
		return `systems/dnd4e/templates/npc-sheet.html`;
	}

	async getData(options) {
		let data = await super.getData(options);

		let immunes = [];
		let resists = [];
		let vulns = [];
		let resistances = Object.values(this.actor.system.resistances);
		for (let res of resistances) {
			if (res.immune) {
				immunes.push(res.label.toLowerCase());
			} else if (res.res > 0) {
				resists.push(res.res + " " + res.label.toLowerCase());
			} else if (res.vuln > 0) {
				vulns.push(res.vuln + " " + res.label.toLowerCase());
			}
		}

		for (let immunity of this.actor.system.untypedResistances.immunities) {
			immunes.push(immunity);
		}

		for (let resistance of this.actor.system.untypedResistances.resistances) {
			resists.push(resistance);
		}

		for (let vulnerability of this.actor.system.untypedResistances.vulnerabilities) {
			vulns.push(vulnerability);
		}

		let resistText = "";
		if (immunes.length) {
			resistText += "<b>Immune</b>"
			for (let immune of immunes) {
				resistText += " " + immune + ",";
			}
			resistText = resistText.substring(0, resistText.length - 1);
			
			if (resists.length || vulns.length) {
				resistText += "; ";
			}
		}

		if (resists.length) {
			resistText += "<b>Resist</b>"
			for (let resist of resists) {
				resistText += " " + resist + ",";
			}
			resistText = resistText.substring(0, resistText.length - 1);
			
			if (vulns.length) {
				resistText += "; ";
			}
		}

		if (vulns.length) {
			resistText += "<b>Vulnerable</b>"
			for (let vuln of vulns) {
				resistText += " " + vuln + ",";
			}
			resistText = resistText.substring(0, resistText.length - 1);
		}

		data.resistText = resistText;
		data.hasResistText = !!resistText.length;

		return data;
	}

	/* -------------------------------------------- */

	/** @override */
	setPosition(options={}) {
		const position = super.setPosition(options);

		//TODO fix this monstrosity!
		//Because I'm bad at CSS and can't find the solution T_T
		if(this.constructor.name == "Fox4eNPCSheet"){
			const sheetBody = this.element.find(".sheet-body");
			const bodyHeight = position.height - 294;
			sheetBody.css("height", bodyHeight);
		} else {
			const sheetBody = this.element.find(".npc-lower");
			const upper = this.element.find(".npc-upper");
			const bodyHeight = sheetBody.parent().height() - upper.height() - 15; //extra 15 for the padding
			sheetBody.css("height", bodyHeight);
		}
		return position;
	}
}