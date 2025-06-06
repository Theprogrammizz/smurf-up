import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'


function App() {
  const [session, setSession] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [usersOnline, setUsersOnline] = useState([]);

  const chatContainerRef = useRef(null);
  const scroll = useRef();



  console.log(session);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Clear the URL hash so the token is not visible after login
      if (window.location.hash) {
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // signin
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google'
    })
  };

  // sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
  }



  useEffect(() => {
    if (!session?.user) {
      setUsersOnline([])
      return;
    }

    const roomOne = supabase.channel("room_one", {
      config: {
        presence: {
          key: session?.user?.id,
        }
      }
    });

    roomOne.on("broadcast", { event: "message" }, (payload) => {
      console.log('Raw payload:', payload);
      setMessages((prevMessages) => [...prevMessages, payload.payload])
      console.log(messages);
    });

    // Track user presence subscribe!
    roomOne.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await roomOne.track({
          id: session?.user?.id,
        })
      }
    })

    // handle user presence
    roomOne.on("presence", { event: "sync" }, () => {
      const state = roomOne.presenceState();
      setUsersOnline(Object.keys(state));
    })

    return () => {
      roomOne.unsubscribe()
    }
  }, [session])

  useEffect(() => {
    console.log("Messages updated:", messages);
  }, [messages]);

  // send message
  const sendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    // Create the message object
    const messageObj = {
      message: newMessage,
      user_name: session?.user?.user_metadata?.full_name,
      avatar: session?.user?.user_metadata?.avatar_url,
      timeStamp: new Date().toISOString()
    };

    // Add to local state immediately
    setMessages(prev => [...prev, messageObj]);

    // Broadcast to others
    supabase.channel("room_one").send({
      type: 'broadcast',
      event: 'message',
      payload: messageObj
    });

    setNewMessage('');
  };

  // Timestamps
  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('en-us', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  };

  useEffect(() => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop
          = chatContainerRef.current.scrollHeight;
      }
    }, [100])
  }, [messages])

  if (!session) {
    return (
      <div className='w-full flex h-screen justify-center items-center p-4'>
        <button onClick={signIn}>
          Sign in with Google to chat
        </button>
      </div>
    )
  } else {
    return (
      <div className='w-full flex h-screen justify-center items-center p-4'>
        <div className='border-[1px] border-gray-700 max-w-6xl w-full min-h-[600px] rounded-lg'>
          {/* Header */}
          <div className='flex justify-between h-20 border-b-[1px] border-gray-700'>
            <div className=' p-4'>
              <p className='text-gray-300'>Signed in as {session?.user?.user_metadata?.full_name}</p>
              <p className='text-gray-300 italic text-sm'>{usersOnline.length} users online</p>
            </div>
            <button onClick={signOut} className='m-2 sm:mr-4'>Sign out</button>
          </div>

          {/* main chat */}
          <div ref={chatContainerRef} className='p-4 flex flex-col overflow-y-auto h-[450px]'>
            {messages.map((msg, idx) => (
              <div key={idx} className={`my-2 flex w-full items-start ${msg?.user_name === session?.user?.user_metadata?.full_name ? "justify-end" : "justify-start"}`}>
                <div className='flex flex-col w-full '>
                  {/* Show sender name for received messages */}
                  {msg?.user_name !== session?.user?.user_metadata?.full_name && (
                    <p className='text-xs text-gray-400 ml-2 mb-1'>{msg?.user_name}</p>
                  )}

                  <div className={`p-1 max-w-[70%] rounded-xl ${msg?.user_name === session?.user?.user_metadata?.full_name
                      ? "bg-gray-700 text-white ml-auto" : "bg-gray-500 text-white mr-auto"
                    }`}>
                    <p>{msg.message}</p>
                  </div>
                  {/* timestamp */}
                  <div className={`text-xs opacity-70 pt-1 ${msg?.user_name === session?.user?.user_metadata?.full_name
                      ? "text-right mr-2" : "text-left ml-2"
                    }`}>
                    {formatTime(msg?.timeStamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>


          {/* message input */}
          <form onSubmit={sendMessage} className='flex flex-col sm:flex-row p-4 border-t-[1px] border-gray-700'>

            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              type="text"
              placeholder='type a message...'
              className='p-2 w-full bg-[#00000040] rounded-lg' />

            <button className='mt-4 sm:mt-0 sm:ml-8 text-white max-h-12'>Send</button>
            <span ref={scroll}></span>
          </form>
        </div>
      </div>
    )
  }


}

export default App
