import defaultEnvStore from './defaultEnvStore'

const envReducer = (
    state = defaultEnvStore,
    action
) => {

    switch (action.type) {
        case "SET_APP_LOADING":
            state = {
                ...state,
                apploading: action.payload
            }
            break

        case "SET_ChatboxMode":
            state = {
                ...state,
                chatboxMode: action.payload
            }
            break

        default:
            break
    }

    return state
}

export default envReducer
