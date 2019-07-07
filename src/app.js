'use strict';

// ------------------------------------------------------------------
// APP INITIALIZATION
// ------------------------------------------------------------------

const { App } = require('jovo-framework');
const { Alexa } = require('jovo-platform-alexa');
const { GoogleAssistant } = require('jovo-platform-googleassistant');
const { JovoDebugger } = require('jovo-plugin-debugger');
const { FileDb } = require('jovo-db-filedb');

const app = new App();

app.use(
    new Alexa(),
    new GoogleAssistant(),
    new JovoDebugger(),
    new FileDb()
);

var firebase = require("firebase-admin");
var serviceAccount = require("/Users/chriskasper/Documents/College/Senior Design/AlexaSkill/pharm-assist/serviceAccountKey.json");
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://pharm-assist-box.firebaseio.com"
});

// ------------------------------------------------------------------
// APP FUNCTIONS
// ------------------------------------------------------------------

function parseSchedule(jsonSched) {
	var set = new Set();

	var numMeds = Object.keys(jsonSched).length;
	var medKeys = Object.keys(jsonSched);

	var todayDate = new Date();
	todayDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

	var todayDate_secs = todayDate.getTime() * (1/10) * (1/10) * (1/10);
	var tomorrow_secs = todayDate_secs + 86400;

	for (var i = 0; i < numMeds; i++) {
		var thisMed = medKeys[i];
		var thisMed_times = Object.keys(jsonSched[thisMed]);
		
		for (var j = 0; j < thisMed_times.length; j++) {
			var thisTime = thisMed_times[j];
			var t = parseInt(thisTime, 10);

			if ((t > todayDate_secs) && (t < tomorrow_secs)) {
				set.add(t);
			}
		}
	}

	if (set.size == 0) {
		return "No more medications will be dispensed today"
	} else {
		var resp = "You will need to take your medications at the following times: ";
		var arr = Array.from(set).sort();

		for (var i = 0; i < set.size; i++) {
			var thisStr = "";
			var d = new Date(0);
			d.setUTCSeconds(arr[i]);

			var h = d.getHours();
			var m = d.getMinutes();

			if (h > 0 && h <= 12) {
				thisStr = thisStr + h;
			} else if (h > 12) {
				thisStr = thisStr + (h - 12);
			} else if (h == 12) {
				thisStr = thisStr + 12;
			}

			thisStr += (m < 10) ? ":0" + m : ":" + m;
			thisStr += (h >= 12) ? " PM" : " AM";

			resp = resp + thisStr + ", ";
		}
	}
	return resp;	
}

// ------------------------------------------------------------------
// APP LOGIC
// ------------------------------------------------------------------

app.setHandler({
    LAUNCH() {
        return this.toIntent('PharmAssistIntent');
    },

    PharmAssistIntent() {
		this.ask('Welcome to Pharm-Assist! What would you like to know?');
    },

    async MedicationsTodayIntent() {
		var s = "";
		const ref = firebase.database().ref("users/RkTIKV5LxdUduoDmuQ0Ws5nV61p2/schedule");
		const snapshot = await ref.once('value');
		const sched = snapshot.val();

		console.log(sched);

		if (sched == null) {
			s = 'You currently don\'t have any medications to take';
		} else {
			var jsonSched = JSON.parse(JSON.stringify(sched));

			s = parseSchedule(jsonSched);
		}

		this.tell(s);
	},

	async MedicationNowIntent() {
		var s = "";
		const ref = firebase.database().ref("users/RkTIKV5LxdUduoDmuQ0Ws5nV61p2/readyToDispense");
		const snapshot = await ref.once('value');
		const result = snapshot.val();

		if (result == null) {
			s = 'You currently don\'t have any medications to take';
		} else {
			s = 'Yes, there is medication waiting to be dispensed to you';
		}

		this.tell(s);
	},
	
	// // For dispensing medication
	async DispenseMedicationIntent() {
		var s = "";
		const ref = firebase.database().ref("users/RkTIKV5LxdUduoDmuQ0Ws5nV61p2/readyToDispense");
		const snapshot = await ref.once('value');
		const result = snapshot.val();

		if (result == null) {
			s = 'You currently don\'t have any medications to take';
		} else {
			var i;
			var result_mod = result.substring(5, result.length - 2).split(",");

			for (i = 0; i < result_mod.length; i++) {
				var epoch = result_mod[i].trim();
				var ref2 = firebase.database().ref("users/RkTIKV5LxdUduoDmuQ0Ws5nV61p2/dispenseNow/");
				await ref2.push().set({
					"epoch": epoch
				});
			}

			s = 'Dispensing your medication now';
		}

		this.tell(s);
	},

});

module.exports.app = app;
