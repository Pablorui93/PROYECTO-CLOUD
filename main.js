import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, onSnapshot, collection, query, addDoc, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


const firebaseConfig = {
    apiKey: "AIzaSyBkx1FiQDPYBlIiRmronUyViJsFMrna8ys",
    authDomain: "proyecto-cloud-28e64.firebaseapp.com",
    projectId: "proyecto-cloud-28e64",
    storageBucket: "proyecto-cloud-28e64.firebasestorage.app",
    messagingSenderId: "940902504128",
    appId: "1:940902504128:web:b9a050da80ac17f1093f25",
    measurementId: "G-623FXY9SER"
};

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Elementos del DOM
const statusMessageEl = document.getElementById('status-message');
const chatContainerEl = document.getElementById('chat-container');
const loadingContainerEl = document.getElementById('loading-container');
const messagesListEl = document.getElementById('messages-list');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const userIdDisplay = document.getElementById('user-id');

let db;
let auth;
let currentUserId = null;
let isAuthReady = false;

// Función para inicializar los Servicios Cloud
async function initializeCloudServices() {

    if (!firebaseConfig.apiKey) {
        statusMessageEl.textContent = "Error: Configuración de Firebase no válida. (Falta clave API)";
        loadingContainerEl.classList.add('hidden');
        return;
    }

    // 1. Inicializar la App (Servicio Cloud PaaS/Hosting)
    const app = initializeApp(firebaseConfig);

    // 2. Inicializar Firestore (Servicio Cloud DBaaS)
    db = getFirestore(app);
    setLogLevel('debug');

    // 3. Inicializar Auth (Servicio Cloud IDaaS)
    auth = getAuth(app);


    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Error durante la autenticación:", error);
        statusMessageEl.textContent = "Error de autenticación. Intenta refrescar.";
    }


    onAuthStateChanged(auth, (user) => {
        loadingContainerEl.classList.add('hidden');
        isAuthReady = true;

        if (user) {
            currentUserId = user.uid;
            userIdDisplay.textContent = currentUserId;
            statusMessageEl.textContent = `Autenticado como ${user.isAnonymous ? 'Anónimo' : 'Usuario'}.`;
            chatContainerEl.classList.remove('hidden');
            sendButton.disabled = false;

            // Iniciar la escucha de mensajes (Integra DBaaS y PaaS/FaaS)
            listenForMessages();
        } else {
            currentUserId = null;
            statusMessageEl.textContent = "Sesión cerrada o error de conexión.";
            chatContainerEl.classList.add('hidden');
            sendButton.disabled = true;
        }
    });
}

// Función para enviar un mensaje (Lógica del servicio en la nube)
async function sendMessage() {
    if (!messageInput.value.trim() || !currentUserId) return;

    const messageText = messageInput.value.trim();
    messageInput.value = ''; 

    // Ruta de la colección de la DB Cloud: /artifacts/{appId}/public/data/messages
    const chatCollectionPath = `artifacts/${appId}/public/data/messages`;

    const clientTimestamp = Date.now();

    try {
        // Escribe el documento en Firestore (DBaaS)
        await addDoc(collection(db, chatCollectionPath), {
            text: messageText,
            userId: currentUserId,
            timestamp: serverTimestamp(), // Marca de tiempo de Firestore (para consistencia a largo plazo)
            clientTimestamp: clientTimestamp // Marca de tiempo local (para ordenamiento inmediato)
        });
    } catch (error) {
        console.error("Error al enviar el mensaje:", error);
        statusMessageEl.textContent = "Error al enviar el mensaje. Revisa la consola.";
    }
}


function listenForMessages() {
    if (!db) return;

    const chatCollectionPath = `artifacts/${appId}/public/data/messages`;
    const messagesQuery = query(collection(db, chatCollectionPath));


    onSnapshot(messagesQuery, (snapshot) => {
        messagesListEl.innerHTML = ''; // Limpiar la lista

        const messages = [];
        snapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });

        messages.sort((a, b) => {
            const timeA = a.clientTimestamp || (a.timestamp?.toMillis() || 0);
            const timeB = b.clientTimestamp || (b.timestamp?.toMillis() || 0);

            if (timeA < timeB) return -1;
            if (timeA > timeB) return 1;

            // Desempate por ID de documento si los tiempos son idénticos
            return a.id.localeCompare(b.id);
        });

        console.log("Mensajes ordenados (Antiguo -> Reciente):", messages.map(m => m.text));



        if (messages.length === 0) {
            messagesListEl.innerHTML = '<div class="text-center text-gray-400 p-4">¡Aún no hay mensajes! Sé el primero.</div>';
            return;
        }

        messages.forEach(message => {
            const isSelf = message.userId === currentUserId;

            const messageEl = document.createElement('div');

            messageEl.className = `max-w-[80%] p-3 rounded-xl shadow-sm text-sm break-words ${isSelf ? 'chat-bubble-self' : 'chat-bubble-other'
                }`;

            // Contenido del mensaje
            const userSpan = document.createElement('span');
            // Mostrar solo una porción del ID para la UI
            userSpan.className = `font-semibold text-xs mb-1 block ${isSelf ? 'text-green-800' : 'text-blue-600'}`;
            userSpan.textContent = isSelf ? 'Tú' : 'Usuario: ' + message.userId.substring(0, 8) + '...';

            const textP = document.createElement('p');
            textP.textContent = message.text;

            messageEl.appendChild(userSpan);
            messageEl.appendChild(textP);
            messagesListEl.appendChild(messageEl); 
        });


        messagesListEl.scrollTop = messagesListEl.scrollHeight;
    }, (error) => {
        console.error("Error al escuchar los mensajes:", error);
        messagesListEl.innerHTML = '<div class="text-center text-red-500 p-4">Error al cargar el chat.</div>';
    });
}


sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Iniciar la aplicación y conectar los servicios cloud
window.onload = initializeCloudServices;