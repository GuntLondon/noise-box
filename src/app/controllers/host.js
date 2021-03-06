/**
 * NoiseBox
 * host.js
 *
 * Host route controller.
 */

var server = require("./../../server");
var app = server.app;
var io = server.io;
var model = server.model;
var constants = server.constants;
var templateOptions = require("./../middleware/template-options");
var stats = require("./../middleware/stats");
var AbstractController = require("./abstract.js");
var _ = require("underscore");
var log = require("../lib/log");

var HostController = {

    init : function() {

        // listen for model changes

        model.on(constants.USER_ADDED,this.updateNoiseBoxStats);
        model.on(constants.USER_REMOVED,this.updateNoiseBoxStats);
        model.on(constants.USER_ADDED,this.userChanged);
        model.on(constants.USER_UPDATED,this.userChanged);
        model.on(constants.USER_REMOVED,this.userChanged);
        model.on(constants.HOST_ADDED,this.updateNoiseBoxStats);
        model.on(constants.HOST_ADDED,this.listUsers);
        model.on(constants.USER_ADDED,this.listUsers);
        model.on(constants.HOST_REMOVED,this.updateNoiseBoxStats);
        model.on(constants.TRACK_ADDED,this.trackAdded);
        model.on(constants.TRACK_REMOVED,this.trackRemoved);
        model.on(constants.LOG_UPDATED,this.logUpdated);


        // Map route to middleware and rendering function:

        app.get("/host/:id",templateOptions(),stats(),function (req,res) {

            var id = req.params.id;

            if ( !model.noiseBoxExists(id) ) {
                createNoiseBox(req,res,id);
                return;
            }

            res.extendTemplateOptions({
                title: "Hosting " + id + " | " + res.templateOptions.title,
                clientType:constants.TYPE_HOST,
                userURL : res.templateOptions.host+"/"+id,
                id : id
            });

            res.render(constants.TYPE_HOST,res.templateOptions);
        });

        app.post("/host",function (req,res) {

            var id = req.body.id;
            createNoiseBox(req,res,id);
        });


        function createNoiseBox(req,res,id){
            var msg;
            var error = false;

            if ( typeof id === "undefined" ) {
                error = true;
                msg = "Uh oh, something's wrong. Try again later ...";
            }

            if ( !HostController.isValidNoiseBoxID(id) ) {
                error = true;
                msg = "That isn't a valid NoiseBox name. The name must be 20 characters or less and consist only of letters and numbers with no spaces.";
            }

            if ( model.noiseBoxExists(id) ) {
                error = true;
                msg = "Unable to create that NoiseBox, try a different name ...";
            }

            if ( error ) {
                req.session.flashMessage = msg;
                res.redirect("/");
            } else {
                log.info("created noise-box model",{id:id});
                model.addNoiseBox(id);
                res.redirect("/host/"+id);
            }
        }

        // Attach socket events:

        io.sockets.on(constants.CLIENT_SOCKET_CONNECTION,function (socket) {

            socket.on(constants.CHAT_MESSAGE_SENT,function(data) {
                AbstractController.chatMessageSent(data);
            });

            socket.on(constants.HOST_TRACK_PLAYING,function(data) {
                AbstractController.trackPlaying(data);
            });

            socket.on(constants.HOST_TRACK_COMPLETE,function(data) {
                AbstractController.trackComplete(data);
            });

            socket.on(constants.HOST_CONNECT,function (data) {
                HostController.onConnect(data,socket);
            });

            socket.on(constants.SOCKET_DISCONNECT,function (data) {
                HostController.onDisconnect(data,socket);
            });
        });
    },

    /**
     * Called when a host client socket has connected.
     *
     * @param data Data object sent from client.
     * @param socket Socket instance for the client.
     */
    onConnect : function (data,socket) {

        var nb = model.getNoiseBox(data.id);

        if ( !nb ) { return; }

        log.info("created host",{socketid:socket.id,noiseboxid:data.id});

        nb.addHost(socket.id,socket);
    },


    /**
     * Generic socket disconnect. This callback is called when *any* socket disconnects (not just
     * host clients) so we need to check that the disconnecting client is a host, and if so remove
     * it from the model.
     *
     * @param data Data object sent from the client.
     * @param socket Socket instance that has disconnected.
     */
    onDisconnect : function (data,socket) {

        var nb = model.getNoiseBoxByClientSocketID(socket.id);

        if ( !nb ) { return; }

        if ( nb.hostExists(socket.id) ) {

            log.info("removed host",{socketid:socket.id,noiseboxid:nb.id});
            nb.removeHost(socket.id);

            // that was the last host so boot all the users out
            log.info("removed hosts users",{socketid:socket.id,noiseboxid:nb.id});
            if (nb.hosts.length < 1) {
                nb.users.each(function(user){
                    user.get('socket').emit(server.constants.SERVER_BOOT_CLIENT,{
                        message: 'The host no longer exists'
                    });
                });

                // now destroy the noisebox
                console.log('removed noisebox',{noiseboxid:nb.id});
                model.removeNoiseBox(nb.id);
            }
        }
    }
};

_.extend(HostController, AbstractController);

module.exports = HostController;
