console.log("Bot is starting");

const { WebClient, RTMClient } = require('@slack/client');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var config = require('./config.js');

const web = new WebClient(config.xoxp);
const rtm = new RTMClient(config.xoxb);
const url ="https://slack.com/api/users.list?token="+config.xoxb+"&pretty=1";

rtm.start();
var channels=[""];
var receivers=[""];
var senders=[""];
var anons=[""];
var types=[""];

var intro="Hello, I am anonbot. You can send anonymous messages to other users in this channel through me!";
var ctr = 1;
rtm.on('message', (message) => {//constantly listen for new messages
  console.log(`(channel:${message.channel}) ${message.user} says: ${message.text}`);
  var [index,firstTime] = getIndex(message.channel);//get the info of this conversation
  if (firstTime) {//if this is the first time, greet them
    respond(rtm,intro,message.channel);
  }
  senders[index] = message.user;
  var response = Purpose(message.text,message.channel,index);
  if (response) {//respond with what the converdation handler said
    respond(rtm,response,message.channel);
  }
});

function Purpose(message,chan,index){//conversation handler that captures the purpose of the user, returns a proper response
  if (message.toLowerCase() == "help") {
    return "To exit from current conversation type exit.\nTo start a conversation with someone anonymously, specify the full name of the person with the following format: rec:Bob Dylan or rec:Michael Jordan\n Please note that the full name section is case sensitive\nTo see the current receiver type summary";
  }
  else if (message.toLowerCase() == "exit"){
    channels.splice(index,1);
    receivers.splice(index,1);
    anons.splice(index,1);
    types.splice(index,1);
    senders.splice(index,1);
    return "Conversation is exited. Bye bye!";
  }
  else if(message.toLowerCase() == "summary"){
    if (types[index]) {
      var id = -1;
      for (var i = 0; i < senders.length; i++) {
        if (receivers[index] == senders[i]) {
          id = i;
        }
      }
      return "Current conversation is with "+anons[id];
    } else {
      if (typeof receivers[index] !== 'undefined' && receivers[index] != "") {
        return "Current conversation is with "+receivers[index];
      }
      else{return "You did not specify a receiver yet";}
    }
  }
  else if (message.toLowerCase().substr(0,4) == "rec:") {//handles the receiver
    var rec = message.substr(4);
    if (rec.includes("anon")) {
      var id = getId(rec);
      if (id != -1) {
        receivers[index] = senders[id];
        types[index] = 1;//type 1 is to anonymous
        return "You are now talking to "+rec;
      }
      else{return "No anonymous identity was found with the name "+rec;}
    } else {
      if (anons[index] == "") {
        anons[index]="anon"+ctr;
        ctr += 1;
      }
      receivers[index] = rec;
      types[index] = 0;//type 0 is from anonymous
      sendMessage(rec,"",chan);
    }
    return "";
  }
  else{
    if (typeof receivers[index] !== 'undefined' && receivers[index] != "") {
      if (types[index] == 1) {
        message = senders[index]+" : "+message;
        sendMessageId(receivers[index],message,chan);//send message to anon
        return 0;
      } else if(types[index] == 0) {
        message = anons[index]+" : "+ message;
        sendMessage(receivers[index],message,chan);//send message as anon
        return 0;
      }
    }
    else {
      return "You need to specify a receiver, type help to learn how";
    }
  }
}

function getIndex(channel){//find the index of the channel, create one if it does not exist
  var index = -1;
  var firstTime = true;
  for (var i = 0; i < channels.length; i++) {
    if(channels[i] == channel){
      index = i;
      firstTime = false;
    }
  }
  if (index == -1) {//this channel does not exist, let us create a new one
    channels.push(channel);
    receivers.push("");
    senders.push("");
    anons.push("");
    types.push("");
    index = channels.length-1;
  }
  return [index,firstTime];
}

function getId(anon){//get the id of the anonymous parameter
  var id = -1;
  for (var i = 0; i < anons.length; i++) {
    if(anons[i] == anon){
      id = i;
    }
  }
  return id;
}

function respond(rtm,response,channel){//send a message to the given channel
  rtm.sendMessage(response, channel)
  .then((res) => {
    console.log('Message sent: ', res.ts);
  })
  .catch(console.error);
}

function get(url,name,message, callback) {//get the entire database corresponding to the slack workspace
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && this.status == 200) {
            if (typeof callback === "function") {
                var inp = [name, message];
                callback.apply(xhr,inp);
            }
        }
    };
    xhr.send();
}

var sendMessageId = function(id,message,chan){//chan is the channel of the sender
  openChannel(id,message,//open a new channel with the given id
    function(message){
      var channel;
      try{
        channel=JSON.parse(this.responseText).channel.id;
      }
      catch(er){//if there is an error respond back to the sender
        respond(rtm,"There is not an anon with those credentials. To get help, please type help",chan);
        return "";
      }
      rtm.sendMessage(message, channel)//actually sending the message
        .then((res) => {
          console.log('Message sent: ', res.ts);
        })
        .catch(console.error);
    });
}

var sendMessage = function(name,message,chan){//chan is the channel of the sender
   get(url,name,message,
      function (name, message) {
          var response  = JSON.parse(this.responseText);
          let i = findIdByName(name,response);//get the id of the name
          openChannel(i,message,
            function(message){//open a new channel to the found id
              var channel;
              try{
                channel=JSON.parse(this.responseText).channel.id;
              }
              catch(er){
                respond(rtm,"There is noone with the name " +name+ ". Please correct the name of the receiver. To get help, you can type help",chan);
                return "";
              }
              if (message=="") {//control message to check if the indeed the name is found
                respond(rtm,"You are now talking to " +name,chan);
              }
              rtm.sendMessage(message, channel)//actually sending the message
                .then((res) => {
                  console.log('Message sent: ', res.ts);
                })
                .catch(console.error);
            }
          );
      }
  );
}

var findIdByName = function(name,data){//return the id of the corresponding name
  for (let i = 0; i < data.members.length; i++) {
    if (data.members[i].real_name == name) {//name matches to the provided name
      return data.members[i].id;//return the id of this column
    }
  }
    return 0;
}

var openChannel = function(id, message,callback){//opens up a channel to the given id
  var xml = new XMLHttpRequest();
  xml.onreadystatechange = function(){
    if(this.readyState == 4 && this.status == 200){
      var obj = JSON.parse(this.responseText);
      if (typeof callback === "function") {
        var inp = [message];
          callback.apply(xml,inp);
      }
    }
  };
  var URL = "https://slack.com/api/im.open?token="+config.xoxb+"&user="+id+"&pretty=1";
  xml.open("post",URL);
  xml.send();
}
