var canDev = require('can-util/js/dev/dev');
var Queue = require('./queue');
var PriorityQueue = require('./priority-queue');
var queueState = require('./queue-state');
var CompletionQueue = require("./completion-queue");
var ns = require("can-namespace");

var batchStartCounter = 0;
var addedNotifyTask = false;
var isFlushing = false;
var batchNum = 0;
var batchData;

var emptyObject = function(){ return {}; };

var NOTIFY_QUEUE, DERIVE_QUEUE, DOM_UI_QUEUE, MUTATE_QUEUE;
NOTIFY_QUEUE = new Queue("NOTIFY", {
	onComplete: function() {
		//console.log("NOTIFY complete.")
		DERIVE_QUEUE.flush();
	},
	onFirstTask: function() {
		//console.log("NOTIFY first task enqueued.")
		if (!batchStartCounter) {
			NOTIFY_QUEUE.flush();
		} else {
			addedNotifyTask = true;
		}
	}
});
DERIVE_QUEUE = new PriorityQueue("DERIVE", {
	onComplete: function() {
		//console.log("DERIVE complete.")
		DOM_UI_QUEUE.flush();
	},
	onFirstTask: function() {
		//console.log("DERIVE first task enqueued.")
		addedNotifyTask = true;
	}
});
DOM_UI_QUEUE = new CompletionQueue("DOM_UI", {
	onComplete: function() {
		//console.log("DERIVE complete.")
		MUTATE_QUEUE.flush();
	},
	onFirstTask: function() {
		//console.log("DERIVE first task enqueued.")
		addedNotifyTask = true;
	}
});

MUTATE_QUEUE = new Queue("MUTATE", {
	onComplete: function() {
		//console.log("MUTATE complete.")
		queueState.lastTask = null;
		isFlushing = false;
	},
	onFirstTask: function() {
		//console.log("MUTATE first task enqueued.")
		addedNotifyTask = true;
	}
});


var queues = {
	Queue: Queue,
	PriorityQueue: PriorityQueue,
	//CompletionQueue: CompletionQueue,
	notifyQueue: NOTIFY_QUEUE,
	deriveQueue: DERIVE_QUEUE,
	domUIQueue: DOM_UI_QUEUE,
	mutateQueue: MUTATE_QUEUE,
	batch: {
		start: function() {
			batchStartCounter++;
			if(batchStartCounter === 1) {
				batchNum++;
				batchData = {number: batchNum};
			}
		},
		stop: function() {
			batchStartCounter--;
			if (batchStartCounter === 0) {
				if (addedNotifyTask) {
					addedNotifyTask = false;
					isFlushing = true;
					NOTIFY_QUEUE.flush();
				}
			}
		},
		isCollecting: function(){
			return batchStartCounter > 0;
		},
		number: function(){
			return batchNum;
		},
		data: function() {
			return batchData;
		}
	},
	enqueueByQueue: function enqueueByQueue(fnByQueue, context, args, makeMeta, reasonLog) {
		if(fnByQueue) {
			makeMeta = makeMeta || emptyObject;
			queues.batch.start();
			["notify", "derive","domUI", "mutate"].forEach(function(queueName) {
				var name = queueName + "Queue";
				var QUEUE = queues[name],
					tasks = fnByQueue[queueName];
				if(tasks !== undefined) {
					tasks.forEach(function(handler) {
						var meta = makeMeta(handler, context, args);
						meta.reasonLog = reasonLog;
						QUEUE.enqueue(handler, context, args, meta);
					});
				}
			});
			queues.batch.stop();
		}
	},
	stack: function(){
		var current = queueState.lastTask;
		var stack = [];
		while(current) {
			stack.push(current);
			current = current.meta.parentTask;
		}
		return stack;
	},
	logStack: function(){
		var stack = this.stack();
		stack.forEach(function(task){
			var log = task.meta && task.meta.log ? task.meta.log : [task.fn.name, task];
			canDev.log.apply(canDev, [task.meta.stack.name + " ran task:"].concat(log));
		});
	},
	taskCount: function(){
		return NOTIFY_QUEUE.tasks.length + DERIVE_QUEUE.tasks.length + DOM_UI_QUEUE.tasks.length + MUTATE_QUEUE.tasks.length;
	},
	flush: function(){
		NOTIFY_QUEUE.flush();
	},
	log: function(){
		NOTIFY_QUEUE.log.apply(NOTIFY_QUEUE, arguments);
		DERIVE_QUEUE.log.apply(DERIVE_QUEUE, arguments);
		DOM_UI_QUEUE.log.apply(DOM_UI_QUEUE, arguments);
		MUTATE_QUEUE.log.apply(MUTATE_QUEUE, arguments);
	}
};
if (ns.queues) {
	throw new Error("You can't have two versions of can-queues, check your dependencies");
} else {
	module.exports = ns.queues = queues;
}
