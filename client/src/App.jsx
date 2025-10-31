import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('https://kuzgun-kart-oyunu.onrender.com/', { autoConnect: false });

// --- BİLEŞENLER ---
const FaceDownCard = React.memo(({ isSelected = false, onClick = () => {} }) => (
  <div onClick={onClick} className={`relative w-20 h-28 rounded-lg transition-all duration-300 cursor-pointer transform-gpu ${isSelected ? 'scale-110 -translate-y-6 shadow-lg shadow-yellow-500/50' : 'hover:-translate-y-2'}`}>
    <div className="absolute w-full h-full rounded-lg bg-blue-800 bg-gradient-to-br from-blue-700 to-blue-900 shadow-lg">
      <div className="absolute inset-0 bg-black/20 opacity-50 [mask-image:repeating-linear-gradient(-45deg,transparent_0_2px,black_2px_4px)]"></div>
    </div>
  </div>
));
const FaceUpCard = React.memo(({ type }) => (
  <div className="relative w-20 h-28 rounded-lg">
    <div className="bg-gray-100 text-gray-900 w-full h-full rounded-md flex items-center justify-center p-2 text-center font-bold text-base shadow-lg">{type}</div>
  </div>
));
const PlayerInfo = ({ username, cardCount, isTurn }) => (
  <div className={`bg-gray-800/80 backdrop-blur-sm p-3 rounded-lg text-center transition-all duration-300 ${isTurn ? 'turn-glow ring-2 ring-yellow-400' : 'ring-1 ring-white/10'}`}>
    <p className="font-bold text-lg truncate">{username}</p>
    <p className="text-sm text-gray-400">{cardCount} Kart</p>
  </div>
);

// --- ANA UYGULAMA BİLEŞENİ ---
function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [showMatchUI, setShowMatchUI] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [gameWinner, setGameWinner] = useState(null);
  const [animation, setAnimation] = useState(null);
  const [isDealing, setIsDealing] = useState(false);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onUpdateRoom = (updatedRoom) => { setGameState(null); setRoom(updatedRoom); setError(''); };
    const onGameStarted = (newGameState) => {
      setRoom(null);
      setGameState(newGameState);
      setIsDealing(true);
      setTimeout(() => setIsDealing(false), 1500);
    };
    const onUpdateGameState = (newGameState) => {
      if (newGameState.lastPlayed?.playerId !== socket.id) {
        setAnimation({ type: 'play', key: Date.now(), from: 'opponent' });
      }
      setGameState(prevState => ({...prevState, ...newGameState}));
    };
    const onMatchOccurred = () => { setShowMatchUI(true); setMatchResult(null); };
    const onMatchResult = (result) => {
      setShowMatchUI(false);
      setMatchResult(result);
      if (result.loser.id) {
        setAnimation({ type: 'collect', key: Date.now(), to: result.loser.id === socket.id ? 'me' : 'opponent' });
      }
      if (result.gameWinner) setGameWinner(result.gameWinner);
      setGameState(prevState => ({...prevState, turn: result.turn, playedCards: result.playedCards, players: result.players}));
      setTimeout(() => setMatchResult(null), 4000);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('updateRoom', onUpdateRoom);
    socket.on('gameStarted', onGameStarted);
    socket.on('updateGameState', onUpdateGameState);
    socket.on('matchOccurred', onMatchOccurred);
    socket.on('matchResult', onMatchResult);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('updateRoom', onUpdateRoom);
      socket.off('gameStarted', onGameStarted);
      socket.off('updateGameState', onUpdateGameState);
      socket.off('matchOccurred', onMatchOccurred);
      socket.off('matchResult', onMatchResult);
    };
  }, []);

  const handleCreateRoom = () => socket.emit('createRoom', () => {});
  const handleJoinRoom = () => { if (roomIdToJoin.trim()) socket.emit('joinRoom', { roomId: roomIdToJoin }, (res) => { if (res.error) setError(res.message); }); };
  const handleStartGame = () => socket.emit('startGame', { roomId: room.roomId });
  const handleSetUsername = () => { if (username.trim().length >= 2 && room) socket.emit('setUsername', { roomId: room.roomId, username: username }); };

  const renderHomeScreen = () => (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-xl p-8 space-y-6">
        <div className="text-center"><h1 className="text-4xl font-bold text-yellow-400">Kuzgun Games</h1><p className="text-gray-400">Kart Oyunu</p><p className="mt-2 text-sm">Bağlantı: <span className={isConnected ? 'text-green-400' : 'text-red-400'}>{isConnected ? 'Bağlı' : 'Bağlı Değil'}</span></p></div>
        <button onClick={handleCreateRoom} className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-105">Yeni Oda Oluştur</button>
        <div className="flex items-center text-gray-500"><hr className="flex-grow border-gray-600"/><span className="px-4">YA DA</span><hr className="flex-grow border-gray-600"/></div>
        <div className="flex flex-col sm:flex-row gap-4">
          <input type="text" placeholder="Oda ID'si girin..." value={roomIdToJoin} onChange={(e) => setRoomIdToJoin(e.target.value)} className="flex-grow bg-gray-700 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"/>
          <button onClick={handleJoinRoom} className="bg-blue-500 hover:bg-blue-600 font-bold py-3 px-6 rounded-lg transition">Katıl</button>
        </div>
        {error && <p className="text-red-400 text-center pt-2">Hata: {error}</p>}
      </div>
    </div>
  );

  const renderLobbyScreen = () => (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg bg-gray-800 rounded-lg shadow-xl p-8 space-y-6">
            <h1 className="text-3xl font-bold text-center">Oda Lobisi</h1>
            <div className="text-center bg-gray-700 p-4 rounded-lg"><p className="text-gray-400">Arkadaşlarınla bu ID'yi paylaş:</p><p className="text-2xl font-mono text-yellow-400 tracking-widest">{room.roomId}</p></div>
            <div className="space-y-3">
                <h2 className="text-xl font-semibold">Oyuncular ({room.players.length}/4)</h2>
                <ul className="bg-gray-700 rounded-lg p-4 space-y-4">
                    {room.players.map((player) => (
                        <li key={player.id} className="flex items-center justify-between p-2">
                           {player.id === socket.id ? (
                               <div className="flex gap-2 w-full">
                                   <input type="text" placeholder="Kullanıcı Adın..." defaultValue={player.username} onChange={(e) => setUsername(e.target.value)} className="flex-grow bg-gray-600 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500" maxLength="15"/>
                                   <button onClick={handleSetUsername} className="bg-green-600 hover:bg-green-700 font-bold px-4 rounded-lg transition">Kaydet</button>
                               </div>
                           ) : (
                               <span className="font-medium text-lg">{player.username}</span>
                           )}
                           {player.id === room.players[0].id && <span title="Oda Kurucusu" className="ml-2">👑</span>}
                        </li>
                    ))}
                </ul>
            </div>
            {room.players[0].id === socket.id && (<button onClick={handleStartGame} disabled={room.players.length < 2} className="w-full bg-yellow-600 hover:bg-yellow-700 text-gray-900 font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed">{room.players.length < 2 ? 'En az 2 oyuncu gerekli' : 'Oyunu Başlat!'}</button>)}
        </div>
    </div>
  );

  const GameScreenComponent = () => {
    const [selectedCardIndex, setSelectedCardIndex] = useState(null);
    const [selectedWord, setSelectedWord] = useState(null);
    const opponent = gameState.players?.find(p => p.id !== socket.id);
    const me = gameState.players?.find(p => p.id === socket.id);
    const myHandRef = useRef(null);
    const opponentHandRef = useRef(null);
    const centerDeckRef = useRef(null);
    
    const handlePlayTurn = () => {
      if (selectedCardIndex === null || !selectedWord) return;
      setAnimation({ type: 'play', key: Date.now(), from: 'me' });
      socket.emit('playCard', { roomId: gameState.roomId, selectedCardIndex, selectedWord });
      setGameState(gs => ({...gs, players: gs.players.map(p => p.id === socket.id ? {...p, cardCount: p.cardCount - 1} : p)}));
      setSelectedCardIndex(null); setSelectedWord(null);
    };
    const handleReaction = () => { socket.emit('playerReacted', { roomId: gameState.roomId }); setShowMatchUI(false); };
    const getAnimationStyles = () => {
        if (!animation || !myHandRef.current || !opponentHandRef.current || !centerDeckRef.current) return {};
        const handRect = animation.from === 'me' ? myHandRef.current.getBoundingClientRect() : opponentHandRef.current.getBoundingClientRect();
        const deckRect = centerDeckRef.current.getBoundingClientRect();
        const targetHandRect = animation.to === 'me' ? myHandRef.current.getBoundingClientRect() : opponentHandRef.current.getBoundingClientRect();
        let startX, startY, endX, endY, animationClass;
        if (animation.type === 'play') {
            startX = `${handRect.left + handRect.width / 2}px`;
            startY = `${handRect.top + handRect.height / 2}px`;
            endX = `${deckRect.left + deckRect.width / 2}px`;
            endY = `${deckRect.top + deckRect.height / 2}px`;
            animationClass = 'animate-play-card';
        } else if (animation.type === 'collect') {
            startX = `${deckRect.left + deckRect.width / 2}px`;
            startY = `${deckRect.top + deckRect.height / 2}px`;
            endX = `${targetHandRect.left + targetHandRect.width / 2}px`;
            endY = `${targetHandRect.top + targetHandRect.height / 2}px`;
            animationClass = 'animate-collect-cards';
        }
        return { '--start-x': startX, '--start-y': startY, '--end-x': endX, '--end-y': endY, className: `card-animation-base ${animationClass}` };
    };

    if (gameWinner) { return ( <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 text-center"><h1 className="text-6xl font-black text-yellow-400 mb-4 animate-pulse">Oyun Bitti!</h1><p className="text-3xl">Kazanan: <span className="font-bold text-white">{gameWinner.username}</span></p><button onClick={() => window.location.reload()} className="mt-8 bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-lg">Ana Menü</button></div> ); }
    if (isDealing) {
        return (
          <div className="min-h-screen w-full bg-gradient-to-br from-gray-800 via-green-900 to-gray-900 relative overflow-hidden">
            {Array.from({ length: me?.cardCount || 0 }).map((_, i) => (
              <div key={`deal-me-${i}`} className="card-animation-base animate-deal-player" style={{ '--i': i, '--r': `${Math.random()*20-10}deg`, animationDelay: `${i * 100}ms` }} />
            ))}
            {Array.from({ length: opponent?.cardCount || 0 }).map((_, i) => (
              <div key={`deal-opp-${i}`} className="card-animation-base animate-deal-opponent" style={{ '--i': i, '--r': `${Math.random()*20-10}deg`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        );
    }

    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-800 via-green-900 to-gray-900 text-white flex flex-col items-center p-4 relative overflow-hidden perspective-1000">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-800/40 to-transparent"></div>
        {animation && <div key={animation.key} style={getAnimationStyles()} onAnimationEnd={() => setAnimation(null)} />}
        {showMatchUI && ( <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"><button onClick={handleReaction} className="w-64 h-64 rounded-full bg-yellow-500 text-gray-900 text-7xl font-black animate-pulse transform hover:scale-110 transition-transform duration-300 shadow-2xl shadow-yellow-500/50">GO!</button></div> )}
        {matchResult && ( <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-gray-800/90 p-4 rounded-lg shadow-lg z-20"><p className="text-center font-bold text-lg"><span className="text-red-400">{matchResult.loser.username}</span> {matchResult.cardsTakenCount} kart aldı!<br/><span className="text-xs font-normal">En hızlı: <span className="text-green-400">{matchResult.fastest?.username || '...'}</span></span></p></div> )}
        
        <div ref={opponentHandRef} className="w-full flex flex-col items-center mb-auto z-10">
          {opponent && <PlayerInfo username={opponent.username} cardCount={opponent.cardCount} isTurn={gameState.turn === opponent.id} />}
          <div className={`flex justify-center -space-x-12 mt-2 h-28 transition-all duration-300 ${gameState.turn === opponent?.id ? 'turn-glow rounded-full p-2' : ''}`}>
            {Array.from({ length: opponent?.cardCount || 0 }).map((_, i) => <FaceDownCard key={i} />)}
          </div>
        </div>

        <div ref={centerDeckRef} className="w-full max-w-sm h-40 flex items-center justify-center p-4 my-4 z-10">
          {gameState.lastPlayed ? <FaceUpCard type={gameState.lastPlayed.card} /> : <div className="w-20 h-28 rounded-lg border-2 border-dashed border-white/20"></div>}
        </div>

        <div ref={myHandRef} className="w-full flex flex-col items-center mt-auto z-10">
          <div className={`flex justify-center -space-x-10 h-32 transition-all duration-300 ${gameState.turn === me?.id ? 'turn-glow rounded-full p-2' : ''}`}>
            {Array.from({ length: me?.cardCount || 0 }).map((_, i) => <FaceDownCard key={i} isSelected={selectedCardIndex === i} onClick={() => gameState.turn === socket.id && setSelectedCardIndex(i)} />)}
          </div>
          {me && <PlayerInfo username="Sen" cardCount={me.cardCount} isTurn={gameState.turn === me.id} />}
          {gameState.turn === socket.id && !showMatchUI && (
            <div className="bg-gray-900/70 p-4 mt-4 rounded-xl w-full max-w-lg backdrop-blur-sm ring-1 ring-white/10">
              <div className="flex justify-center gap-2 flex-wrap">{['Döner', 'İnek', 'Eşek', 'Pide', 'Kebap'].map(w => (<button key={w} onClick={() => setSelectedWord(w)} className={`font-bold py-2 px-4 rounded-lg transition ${selectedWord === w ? 'bg-yellow-500 text-gray-900 scale-110' : 'bg-gray-700 hover:bg-gray-600'}`}>{w}</button>))}</div>
              <div className="text-center mt-4"><button onClick={handlePlayTurn} disabled={selectedCardIndex === null || !selectedWord} className="bg-red-600 hover:bg-red-700 font-bold py-3 px-10 text-xl rounded-lg transition disabled:bg-gray-500/50 disabled:scale-100 transform hover:scale-110">Oyna!</button></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Ana Render Kararı
  if (!isConnected) return <div className="min-h-screen text-white bg-gray-900 flex items-center justify-center"><p>Sunucuya bağlanılıyor...</p></div>;
  if (gameWinner) return <GameScreenComponent />;
  if (gameState) return <GameScreenComponent />;
  if (room) return renderLobbyScreen();
  return renderHomeScreen();
}

export default App;
