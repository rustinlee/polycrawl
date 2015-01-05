var _und = require('underscore');
var getHTMLFormattedName = require('./chatUtils.js').getHTMLFormattedName;

/* decided not to incorporate this, but I may decide to use it later
function getExplodingRoll () { //returns random number from 0 to infinity
	var result = (Math.random() + Math.random()) / 2;
	if (result > 0.85)
		result += getExplodingRoll();
	return result;
}
*/

exports.simulateCombat = function(aggressor, target, level, aggressorSocketID, targetSocketID) {
	var aggressorSocket;
	var aggressorNameStr;

	if (aggressorSocketID) {
		aggressorSocket = io.sockets.connected[aggressorSocketID];
		aggressorNameStr = getHTMLFormattedName(aggressorSocket);
	} else {
		aggressorNameStr = 'the ' + aggressor.fullName.toLowerCase();
	}

	var targetSocket;
	var targetNameStr;

	if (targetSocketID) {
		targetSocket = io.sockets.connected[targetSocketID];
		targetNameStr = getHTMLFormattedName(targetSocket);
	} else {
		targetNameStr = 'the ' + target.fullName.toLowerCase();
	}

	//very simple placeholder calculations
	var weaponLimbs = _und.filter(aggressor.limbs, function(limb) {
		return limb.weapon;
	});

	var weapon = weaponLimbs[Math.floor(Math.random() * weaponLimbs.length)].weapon; //forced to use limbs as weapons since there are no item weapons yet

	var dmg = weapon.baseDamage + weapon.strScaling * aggressor.stats.str; //how much damage the attack can deal

	dmg += Math.ceil((Math.random() * 0.2 - 0.1) * dmg); //add or remove 10% rounded up to give variety
	dmg = Math.floor(dmg); //round off the final damage

	var rollToHit = 1 / (1 + Math.pow(Math.E, -((target.stats.agi / aggressor.stats.dex) * 2 - 4))); //fancy sigmoid function
	var attackHit = (Math.random() * weapon.hitChance >= rollToHit); //did the attack land

	if (attackHit) {
		var critModifier = 1.5; //amount to modify damage if critical hit, should be determined by weapon
		var critted = Math.random() * weapon.critChance > 0.95; //luck stat will probably affect this later on

		if (critted) {
			dmg = Math.ceil(dmg * critModifier);
		}

		target.HP -= dmg;

		if (aggressorSocket) {
			aggressorSocket.emit('chatMessage', { message: 'You have ' + weapon.verb + ' ' +  targetNameStr + ' for ' + dmg + ' damage.'});
			if (critted)
				aggressorSocket.emit('chatMessage', { message: 'Scored a critical hit!'});
		}

		if (targetSocket) {
			targetSocket.emit('chatMessage', { message: aggressorNameStr + ' has ' + weapon.verb + ' you for ' + dmg + ' damage.' });
			targetSocket.emit('hpBarUpdate', (target.HP / target.maxHP) * 100);
			if (critted)
				targetSocket.emit('chatMessage', { message: 'Struck by a critical hit!'});
		}

		if (target.HP <= 0) {
			level.gameEntities = _und.reject(level.gameEntities, function (creature) {
				return creature.id === target.id;
			});

			if (targetSocket) { //respawn creature if a player is controlling it
				targetSocket.emit('chatMessage', { message: 'You have died!' });
				targetSocket.game_player = new Creature(mobDefinitions['human'], dungeon.playerSpawn.x, dungeon.playerSpawn.y, targetSocket.color, targetSocket.id);
				level.gameEntities.push(targetSocket.game_player);
				targetSocket.emit('hpBarUpdate', (targetSocket.game_player.HP / targetSocket.game_player.maxHP) * 100);
				targetSocket.emit('statsData', targetSocket.game_player.stats);
			}
		}
	} else {
		if (aggressorSocket) {
			aggressorSocket.emit('chatMessage', { message: 'You missed ' +  targetNameStr + '.'});
		}

		if (targetSocket) {
			targetSocket.emit('chatMessage', { message: aggressorNameStr + ' swung at you and missed.' });
		}
	}

	io.sockets.emit('entitiesData', [level.getTrimmedGameEntities()]);
}
