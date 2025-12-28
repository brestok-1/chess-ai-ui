import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { SettingsContext } from './SettingsProvider';

import { Chess, Color, PieceSymbol, Square } from 'chess.js';
import { ChessState, chessReducer, createChessState } from '@/game/state';
import { getAIMove } from '@/api/chessApi';

export type PlayerType = 'local' | 'bot';

export interface ChessConfig {
  player_white: PlayerType;
  player_black: PlayerType;
  positions: string;
}

export const XYtoSquare = (x: number, y: number): Square => {
  return `${'abcdefgh'[x]}${8 - y}` as Square;
}

export const SquareToXY = (square: Square): [number, number] => {
  return ["abcdefgh".indexOf(square[0]), 8 - parseInt(square[1])];
}

type StartNewGame_Func = (config: ChessConfig) => void;
type MakeMove_Func = (from: Square, to: Square) => boolean;
type Promote_Func = (from: Square, to: Square, promotion: PieceSymbol) => boolean;
type PotentialMoves_Func = (from_x: number, from_y: number) => { to: Square, flags: string }[];
type UndoMove_Func = () => boolean;
type RedoMove_Func = () => boolean;
type Pause_Func = () => boolean;
type OutOfTime_Func = () => void;

interface ChessInterface {
  state: ChessState;
  anticheat: string | undefined;
  clearAnticheat: () => void;
  StartNewGame: StartNewGame_Func;
  MakeMove: MakeMove_Func;
  Promote: Promote_Func;
  PotentialMoves: PotentialMoves_Func;
  UndoMove: UndoMove_Func;
  RedoMove: RedoMove_Func;
  Pause: Pause_Func;
  OutOfTime: OutOfTime_Func;
}

export const ChessContext = createContext<ChessInterface | null>(null);

export const useChessContext = (): ChessInterface => {
  const chessCtx = useContext(ChessContext);
  if (chessCtx === null) {
    throw new Error('Chess context has not been created.');
  }
  return chessCtx;
};

interface ChessProviderProps {
  children?: React.ReactNode,
}

export const ChessProvider: React.FC<ChessProviderProps> = (props) => {
  const { allowPause, gameLength } = useContext(SettingsContext);
  const [state, setState] = useState(createChessState(gameLength, { w: { name: 'loading', type: 'local' }, b: { name: 'loading', type: 'local' } }));
  const [anticheat, setAnticheat] = useState<string | undefined>();
  const [isAIThinking, setIsAIThinking] = useState(false);
  const stateRef = useRef(new Chess());
  const configRef = useRef<ChessConfig | undefined>(undefined);

  useEffect(() => {
    const thisPlayer = (state.turn === 'b' ? configRef.current?.player_black : configRef.current?.player_white);
    if (thisPlayer === 'bot' && state.redoStack.length === 0 && !isAIThinking && !state.complete) {
      setIsAIThinking(true);
      const fen = stateRef.current.fen();
      
      getAIMove(fen)
        .then((response) => {
          if (response.error) {
            console.error('AI error:', response.error);
            alert('Bot failed to generate a move: ' + response.error);
            return;
          }
          
          if (response.from_square && response.to_square) {
            const from = response.from_square as Square;
            const to = response.to_square as Square;
            const promotion = response.promotion as PieceSymbol | undefined;
            
            setState(oldState => chessReducer(oldState, {
              type: 'move',
              from,
              to,
              promotion,
              time: new Date().getTime(),
              chess: stateRef.current,
            }));
          }
        })
        .catch((error) => {
          console.error('API call failed:', error);
          alert('Failed to connect to AI backend');
        })
        .finally(() => {
          setIsAIThinking(false);
        });
    }
  }, [state.turn, state.complete, isAIThinking]);

  const contextValue: ChessInterface = {
    state,
    anticheat,
    clearAnticheat: () => {
      setAnticheat(undefined);
    },
    StartNewGame: (config: ChessConfig): void => {
      configRef.current = config;
      stateRef.current = new Chess();
      setState(createChessState(gameLength, {
        w: {
          name: 'WHITE',
          type: config.player_white,
        },
        b: {
          name: config.player_black === 'bot' ? 'BOT' : 'BLACK',
          type: config.player_black,
        },
      }));
    },
    MakeMove: (from: Square, to: Square): boolean => {
      setState(oldState => chessReducer(oldState, {
        type: 'move',
        from,
        to,
        time: new Date().getTime(),
        chess: stateRef.current,
      }));
      return true;
    },
    Promote: (from, to, promotion) => {
      setState(oldState => chessReducer(oldState, {
        type: 'move',
        from,
        to,
        promotion,
        time: new Date().getTime(),
        chess: stateRef.current,
      }));
      return true;
    },
    PotentialMoves: (from_x: number, from_y: number): { to: Square, flags: string }[] => {
      return stateRef.current.moves({ square: XYtoSquare(from_x, from_y), verbose: true });
    },
    UndoMove: (): boolean => {
      setState(oldState => chessReducer(oldState, {
        type: 'undo',
        time: new Date().getTime(),
        chess: stateRef.current,
      }));
      return true;
    },
    RedoMove: (): boolean => {
      setState(oldState => chessReducer(oldState, {
        type: 'redo',
        time: new Date().getTime(),
        chess: stateRef.current,
      }));
      return true;
    },
    Pause: (): boolean => {
      if (!allowPause) return false;

      setState(oldState => chessReducer(oldState, {
        type: 'pause',
        time: new Date().getTime(),
      }));
      return true;
    },
    OutOfTime: () => {
      setState(oldState => chessReducer(oldState, {
        type: 'checkTimers',
        time: new Date().getTime(),
        chess: stateRef.current,
      }));
    },
  };

  return (
    <ChessContext.Provider value={contextValue}>
      {
        props.children
      }
    </ChessContext.Provider>
  );
};
