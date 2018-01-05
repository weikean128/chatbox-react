import React, { Component } from 'react'
import { connect } from 'react-redux'
import SocketConnect from './socketapi'
/*import {
    usrReqChatbot_act,
    usrReqLivechat_act
} from './actions/userActions'
import {
    setAppLoading_act
} from './actions/envActions'*/
import {
    pushMsg_act
} from './actions/msgActions'
import Chatbox from './components/Chatbox'
import request from 'superagent'

class App extends Component {

    constructor(props) {
        super(props)

        // storing socket data in my App state locally
        this.state = {
            chatbotSocket: new SocketConnect('chatbotSocket'),
            livechatSocket: new SocketConnect('livechatSocket')
        }
    }

    componentDidMount() {

        let envReducer = this.props.envReducer
        let chatboxMode = envReducer.chatboxMode

        switch (chatboxMode) {
            case 'CHATBOT':
                // chatbot only, connect to my chatbot socket server pls
                this.connectChatbotSocket()
                this.props.dispatch(pushMsg_act({ from: 'bot', msg: ['Hi, I am NEC Chatbot, how may I assist you today?']}))
                break

            case 'LIVECHAT':
                // livechat only, connect to my livechat socket server pls
                this.connectLivechatSocket()
                break

            case 'CHATBOT_LIVECHAT':
                break

            default:
                break
        }

    }

    shouldComponentUpdate(nextProps, nextState) {
        // do not update my component if i am validating the user
        return !nextProps.envReducer.apploading
    }

    componentWillUnmount() {
        // disconnect 
        this.state.chatbotSocket.disconnectSocket()
        this.state.livechatSocket.disconnectSocket()
    }

    connectLivechatSocket = () => {

        // disconnect the previous live chat if exist
        let envReducer = this.props.envReducer
        let livechatSocket = this.state.livechatSocket

        livechatSocket.disconnectSocket()

        // if have livechatId...
        // try to connect with my livechat socket server
        livechatSocket.connectSocket(envReducer.backendUrl + '/lcIO')

        // live chat socket subscribtions
        livechatSocket.subscribe('connect', () => {

            // asking to join room
            livechatSocket.socketEmit('client_join_room', {
                roomId: envReducer.livechatId,
                username: livechatSocket.socket.id,
                message: 'userReducer.userproblem',
                attentionLevel: 1
            })

            livechatSocket.subscribe('client_joined', (data) => {

                console.log('connected liao')

            })

            // waiting for admin to send me some msg
            livechatSocket.subscribe('client_receiving_msg', (data) => {
                //currentAdmin = data.adminUsername
                //console.log(currentAdmin)
                this.props.dispatch(pushMsg_act({ from: 'bot', msg: [data.msg] }))
            })

        })

    }

    connectChatbotSocket = () => {

        // disconnect the chatbot socket if exist
        this.state.chatbotSocket.disconnectSocket()

        let envReducer = this.props.envReducer
        let chatbotSocket = this.state.chatbotSocket

        // connect to my socket server
        chatbotSocket.connectSocket(envReducer.backendUrl + '/cbIO')

        // my chatbot socket server subscription
        chatbotSocket.subscribe('connect', () => {

            // first, asking to join my chatbot room
            chatbotSocket.socketEmit('client_join_room', {
                roomId: envReducer.chatbotId
            })

            chatbotSocket.subscribe('client_joined', (data) => {
                // client successfully joined the room liao
                //this.emitMsgToChatbot('what can you do?')
            })

            chatbotSocket.subscribe('chatbot_send_client', (data) => {
                // receiving msg from chatbot
                this.props.dispatch(pushMsg_act({ from: 'bot', msg: data.msg }))
            })
        })
    }

    emitMsgToChatbot = (msg, nodispatch) => {

        /*let envReducer = this.props.envReducer

        request
            .post(envReducer.backendUrl + '/chatbot/v1/query')
            .set('contentType', 'application/json; charset=utf-8')
            .set('dataType', 'json')
            .send({
                uuid: envReducer.chatbotId,
                text_message: msg,
                sender_id: this.state.chatbotSocket.socket.id
            })
            .end((err, res2) => {
                if (err) {
                    console.error(err.toString())
                }
                // receiving msg from chatbot
                this.props.dispatch(pushMsg_act({ from: 'bot', msg: res2.body }))
            })*/




        // request to api.ai
        request
            .get('https://api.api.ai/v1/query')
            .timeout({ deadline: 60000 })
            .set('Authorization', 'Bearer 68c79635022b490088f854e0cf420154')
            .query({
                v: 20150910,
                query: msg,
                lang: 'en',
                sessionId: this.state.chatbotSocket.socket.id
            })
            .on('error', (err) => { console.log('[/query][error] -> ' + err) })
            .end((err, res) => {

                if (err) {
                    console.log('[/query][info] -> ' + err)
                    this.props.dispatch(pushMsg_act({ from: 'bot', msg: [err] }))
                }
                else {
                    try {
                        let fulfillment = res.body.result.fulfillment
                        if (fulfillment.speech) {
                            // for smalltalk
                            this.props.dispatch(pushMsg_act({ from: 'bot', msg: [fulfillment.speech] }))
                        }
                        else {
                            this.props.dispatch(pushMsg_act({ from: 'bot', msg: fulfillment.messages[0].payload.msg }))
                        }
                    }
                    catch (err) {
                        this.props.dispatch(pushMsg_act({ from: 'bot', msg: [err.toString()] }))
                    }
                }

            })

        this.props.dispatch(pushMsg_act({ from: 'user', msg: msg }))

    }

    emitMsgToLivechatSocket = (msg) => {
        // emit to live chat socket server about this updated username and problem
        this.state.livechatSocket.socketEmit('client_send_admin_msg', {
            clientSocketId: this.state.livechatSocket.socket.id,
            clientUsername: this.state.livechatSocket.socket.id,
            adminUsername: 'currentAdmin',
            msg: msg
        })
        this.props.dispatch(pushMsg_act({ from: 'user', msg: msg }))
    }

    render() {

        let envReducer = this.props.envReducer
        let chatboxMode = envReducer.chatboxMode

        switch (chatboxMode) {
            case 'CHATBOT':
                // only chatbot

                break

            case 'LIVECHAT':
                // straight away show the live chat form at the very begining pls

                break

            case 'CHATBOT_LIVECHAT':
                // chatbot first.. then if user want live chat.. then submit messages to live chat people

                break

            default:
                break
        }

        return (
            <Chatbox sendMsg={this.emitMsgToChatbot} allMsgs={this.props.msgReducer}/>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        envReducer: state.envReducer,
        userReducer: state.userReducer,
        msgReducer: state.msgReducer
    }
}

export default connect(mapStateToProps)(App)

/*
    disconnectChatbotSocket = () => {
        this.state.chatbotSocket.disconnectSocket()
    }

    connectToLivechatSocket = () => {

        // disconnect the previous live chat if exist
        this.disconnectLivechatSocket()

        let envReducer = this.props.envReducer
        let userReducer = this.props.userReducer
        let livechatSocket = this.state.livechatSocket

        // if have livechatId...
        // try to connect with my livechat socket server
        livechatSocket.connectSocket(envReducer.backendUrl + '/lcIO')

        // live chat socket subscribtions
        livechatSocket.subscribe('connect', () => {

            console.log('adfasf')

            // asking to join room
            livechatSocket.socketEmit('client_join_room', {
                roomId: envReducer.livechatId,
                username: userReducer.username,
                message: userReducer.userproblem,
                attentionLevel: userReducer.requireAttention
            })

            livechatSocket.subscribe('client_joined', (data) => {

                // set the socket id
                livechatSocket.setSocketId(data.socketId)

                // live chat has connected
                this.props.dispatch(setHasLivechatConnect_act(true))

            })

        })

    }

    disconnectLivechatSocket = () => {
        this.state.livechatSocket.disconnectSocket()
    }

    emitUserInfoToLivechatSocket = () => {
        // emit to live chat socket server about this updated username and problem
        this.state.livechatSocket.socketEmit('client_update_info', {
            username: this.props.userReducer.username,
            message: this.props.userReducer.problem
        })
    }

    updateUserInfo = async (username, problem, successCB) => {

        // loading screen start
        /*this.props.dispatch(setValidatingUser_act(true))

        await this.props.dispatch(setLivechatRequirement_act(username, problem))

        this.emitUserInfoToLivechatSocket()

        successCB()

        // finish loading
        this.props.dispatch(setValidatingUser_act(false))

    }*/
