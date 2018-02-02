import React, { Component } from 'react'
import { connect } from 'react-redux'
import SocketConnect from './socketapi'
import {
    usrReqLivechat_act,
    usrUpdateInfo_act
} from './actions/userActions'
import {
    setAdminInfo_act
} from './actions/adminActions'
/*import {
    setAppLoading_act
} from './actions/envActions'*/
import {
    pushMsg_act,
    popMsg_act
} from './actions/msgActions'
import Chatbox from './components/Chatbox'
import request from 'superagent'

class App extends Component {

    constructor(props) {
        super(props)

        // storing socket data in my App state locally
        this.state = {
            chatbotSocket: new SocketConnect('chatbotSocket'),
            livechatSocket: new SocketConnect('livechatSocket'),
            intervalId: 0,
            sendFormDisabled: false
        }
    }

    componentDidMount() {

        const { envReducer, dispatch } = this.props
        const chatboxMode = envReducer.chatboxMode

        switch (chatboxMode) {
            case 'CHATBOT':
                // chatbot only, connect to my chatbot socket server pls
                this.connectChatbotSocket()
                // simple rating prompt timer
                this.setState({ intervalId: setInterval(this.timer, 300000) })
                break

            case 'LIVECHAT':
                // livechat only
                this.sendFormDisableMah(true)
                dispatch(usrReqLivechat_act())
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
        // clear the timer
        clearInterval(this.state.intervalId)
        // disconnect socket server
        this.state.chatbotSocket.disconnectSocket()
        this.state.livechatSocket.disconnectSocket()
    }

    timer = () => {
        this.emitMsgToChatbot('rating', true)
        clearInterval(this.state.intervalId)
    }

    sendFormDisableMah = (val) => {
        this.setState({ sendFormDisabled: val })
    }

    connectLivechatSocket = () => {

        const { envReducer, userReducer } = this.props
        let livechatSocket = this.state.livechatSocket

        // do not allow user to send any msg when I am connecting to socket server
        this.sendFormDisableMah(true)

        // disconnect the previous live chat if exist
        livechatSocket.disconnectSocket()

        // if have livechatId...
        // try to connect with my livechat socket server
        livechatSocket.connectSocket(envReducer.backendUrl + '/lcIO')

        // live chat socket subscribtions
        livechatSocket.subscribe('connect', () => {

            // asking to join room
            livechatSocket.socketEmit('client_join_room', {
                roomId: envReducer.livechatId,
                username: userReducer.username,
                message: userReducer.problem,
                attentionLevel: 1
            })

            livechatSocket.subscribe('client_joined', (data) => {
            })

            // waiting for admin to send me some msg
            livechatSocket.subscribe('client_receiving_msg', (data) => {

                this.props.dispatch(pushMsg_act({ from: 'bot', msg: [JSON.stringify({ type: 'TEXT', text: data.msg })] }))
                this.props.dispatch(setAdminInfo_act(data.adminUsername))

                // user can begin to send msg back to admin
                this.sendFormDisableMah(false)
            })

        })

    }

    connectChatbotSocket = () => {

        const { envReducer } = this.props
        let chatbotSocket = this.state.chatbotSocket

        // disconnect the chatbot socket if exist
        chatbotSocket.disconnectSocket()

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
                this.emitMsgToChatbot('tmp form', true)
            })

            chatbotSocket.subscribe('chatbot_send_client', (data) => {
                // receiving msg from chatbot
                this.props.dispatch(pushMsg_act({ from: 'bot', msg: data.msg }))
            })
        })
    }

    executeAction = (backendUrl, next_action, uuid, sender_id) => {
        if (next_action === 'action_listen') {
            // stop calling execute action liao.. done
        }
        else {

            // if there is still got next action
            request
                .post(backendUrl + '/chatbot/v1/executeAction')
                .set('contentType', 'application/json; charset=utf-8')
                .set('dataType', 'json')
                .send({
                    uuid: uuid,
                    action: next_action,
                    sender_id: sender_id
                })
                .end((err, res) => {

                    try {
                        if (err || !res.ok) {
                            let errormsg = res.body.errors
                            throw errormsg
                        }
                        else {
                            let result = res.body

                            if (!result) {
                                throw new Error('no body msg')
                            }

                            // store the action definition
                            result.returnAct.forEach((act, index)=>{
                                if(act.type === 'QR') {
                                    this.sendFormDisableMah(true)
                                }
                            })
                            this.props.dispatch(pushMsg_act({ from: 'bot', msg: JSON.stringify(result.returnAct) }))

                            // execute again to see whether still got any action need to execute mah
                            this.executeAction(backendUrl, result.result.next_action, uuid, sender_id)

                        }
                    } catch (e) {
                        console.log(e.toString())
                    }

                })

        }
    }

    emitMsgToChatbot = (msg, nodispatch) => {

        let envReducer = this.props.envReducer
        const sender_id = this.state.chatbotSocket.socket.id
        const backendUrl = envReducer.backendUrl
        const cbuuid = envReducer.chatbotId

        request
            .post(backendUrl + '/chatbot/v1/query')
            .set('contentType', 'application/json; charset=utf-8')
            .set('dataType', 'json')
            .send({
                uuid: envReducer.chatbotId,
                text_message: msg,
                sender_id: this.state.chatbotSocket.socket.id
            })
            .end((err, res) => {

                try {
                    if (err || !res.ok) {
                        let errormsg = res.body.errors
                        throw errormsg
                    }
                    else {
                        let result = res.body

                        if (!result) {
                            throw new Error('no body msg')
                        }

                        this.executeAction(backendUrl, result.next_action, cbuuid, sender_id)
                    }
                } catch (e) {
                    console.log(e.toString())
                }

            })

        // request to api.ai
        /*request
            .get('https://api.api.ai/v1/query')
            .timeout({ deadline: 60000 })
            .set('Authorization', 'Bearer a1ba0f8c5f254cb3920266e08d76237a')
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
                        console.log(fulfillment);
                        if (fulfillment.speech) {
                            // for smalltalk
                            this.props.dispatch(pushMsg_act({ from: 'bot', msg: [fulfillment.speech], }))
                        }
                        else {
                            this.props.dispatch(pushMsg_act({ from: 'bot', msg: fulfillment.messages[0].payload.msg, msgtype: fulfillment.messages[0].payload.msgtype, msgheader: fulfillment.messages[0].payload.msgheader }))
                        }
                    }
                    catch (err) {
                        this.props.dispatch(pushMsg_act({ from: 'bot', msg: [err.toString()] }))
                    }
                }

            })*/

        if(nodispatch === true) {
        }
        else {
            this.props.dispatch(pushMsg_act({ from: 'user', msg: msg }))
        }

    }

    emitMsgToLivechatSocket = (msg) => {

        const { userReducer, adminReducer } = this.props
        let livechatSocket = this.state.livechatSocket

        // emit to live chat socket server about this updated username and problem
        livechatSocket.socketEmit('client_send_admin_msg', {
            clientSocketId: livechatSocket.socket.id,
            clientUsername: userReducer.username,
            adminUsername: adminReducer.adminName,
            msg: msg
        })

        this.props.dispatch(pushMsg_act({ from: 'user', msg: msg }))

    }

    setUserInfo = (username, email, problem) => {
        this.props.dispatch(usrUpdateInfo_act(username, email, problem)).then((result)=>{
            // connect to livechat after updating the userinfo
            this.connectLivechatSocket()
        })
    }

    popMessage = (indexToPop) => {
        this.props.dispatch(popMsg_act(indexToPop))
    }

    render() {

        const { envReducer, userReducer, msgReducer } = this.props

        let chatboxMode = envReducer.chatboxMode

        switch (chatboxMode) {
            case 'CHATBOT':
                // only chatbot
                return (
                    <Chatbox 
                        sendMsg={this.emitMsgToChatbot}
                        popMessage={this.popMessage}
                        allMsgs={msgReducer}
                        chatboxMode={chatboxMode}
                        setUserInfo={this.setUserInfo}
                        backendUrl={envReducer.backendUrl}
                        sendFormDisabled={this.state.sendFormDisabled}
                        sendFormDisableMah={this.sendFormDisableMah}
                    />
                )

            case 'LIVECHAT':
                // straight away show the live chat form at the very begining pls
                return (
                    <Chatbox 
                        sendMsg={this.emitMsgToLivechatSocket}
                        popMessage={this.popMessage}
                        allMsgs={msgReducer}
                        chatboxMode={chatboxMode}
                        setUserInfo={this.setUserInfo}
                        backendUrl={envReducer.backendUrl}
                        sendFormDisabled={this.state.sendFormDisabled}
                        sendFormDisableMah={this.sendFormDisableMah}
                        userReducer={userReducer}
                    />
                )

            case 'CHATBOT_LIVECHAT':
                // chatbot first.. then if user want live chat.. then submit messages to live chat people
                return (
                    <Chatbox sendMsg={this.emitMsgToChatbot} allMsgs={this.props.msgReducer} />
                )

            default:
                return (
                    <Chatbox sendMsg={this.emitMsgToChatbot} allMsgs={this.props.msgReducer} />
                )

        }

    }
}

const mapStateToProps = (state) => {
    return {
        envReducer: state.envReducer,
        userReducer: state.userReducer,
        msgReducer: state.msgReducer,
        adminReducer: state.adminReducer
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
