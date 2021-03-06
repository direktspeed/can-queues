var Queue = require("./queue");

// This queue does not allow another task to run until this one is complete
var CompletionQueue = function() {
	Queue.apply(this, arguments);
    this.flushCount = 0;
};
CompletionQueue.prototype = Object.create(Queue.prototype);

CompletionQueue.prototype.flush = function() {
    if(this.flushCount > 0) {

    } else {
        this.flushCount ++;
        while (this.index < this.tasks.length) {
    		var task = this.tasks[this.index++];
            //!steal-remove-start
    		this._logFlush(task);
            //!steal-remove-end
    		task.fn.apply(task.context, task.args);
    	}
    	this.index = 0;
    	this.tasks = [];
		this.flushCount--;
    	this.callbacks.onComplete(this);

    }

};



module.exports = CompletionQueue;
