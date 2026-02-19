// src/components/TeamScoreboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Typography, Spin, Alert, Card, Row, Col, Button, Select,
    Divider, List, Tag, message, Avatar, Space, Tooltip, Form, Radio, Statistic,Result
} from 'antd';
import { ArrowLeftOutlined, UserOutlined, PlusOutlined, UndoOutlined, TrophyOutlined  } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getTeamName = (match, teamNumber) => {
    if (!match) return 'N/A';
    const teamData = teamNumber === 1 ? match.team1 : match.team2;
    return teamData?.name || `Team ${teamNumber}`;
};

const renderCurrentPairAvatars = (players, isServing) => {
    const avatarSize = 80;
    const avatarContent = (player) => {
        if (!player) return null;
        const avatarSrc = player.photoUrl ? `${API_URL}${player.photoUrl}` : undefined;
        return (
            <Avatar key={player._id} size={avatarSize} src={avatarSrc} icon={!avatarSrc ? <UserOutlined /> : null}>
                {!avatarSrc ? player.name?.charAt(0)?.toUpperCase() : null}
            </Avatar>
        );
    };
    let avatarComponent;
    if (!players || players.length === 0) {
        avatarComponent = <Avatar size={avatarSize} icon={<UserOutlined />} />;
    } else if (players.length === 1) {
        avatarComponent = avatarContent(players[0]);
    } else {
        avatarComponent = <Avatar.Group max={{ count: 2 }} size={avatarSize}>{players.map(p => avatarContent(p))}</Avatar.Group>;
    }
    if (isServing) {
        return (
            <Tooltip title="Serving">
                <span style={{ border: '3px solid #1677ff', borderRadius: '50%', display: 'inline-block', padding: '3px', lineHeight: 0 }}>
                    {avatarComponent}
                </span>
            </Tooltip>
        );
    }
    return avatarComponent;
};



const TeamScoreboard = () => {
    const { id: matchId } = useParams();
    const navigate = useNavigate();
    const [matchData, setMatchData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false); 
    const [isUpdatingScore, setIsUpdatingScore] = useState(false);
    const [isUndoing, setIsUndoing] = useState(false);
    const [pairSelectionForm] = Form.useForm();

    useEffect(() => {
        if (!matchId) return;
        let isMounted = true;
        const fetchMatch = async () => {
            setLoading(true); setError(null); setFormError(null);
            try {
                const response = await axios.get(`${API_URL}/api/matches/${matchId}`);
                if (isMounted) {
                    setMatchData(response.data);
                    const status = response.data?.status;
                    if (status === 'Upcoming' || status === 'AwaitingSubMatchSetup') {
                        pairSelectionForm.setFieldsValue({ initialServer: 1 });
                    }
                }
            } catch (err) {
                if (isMounted) { setError("Failed to load match data."); }
            } finally {
                if (isMounted) { setLoading(false); }
            }
        };
        fetchMatch();
        return () => { isMounted = false; };
    }, [matchId, pairSelectionForm]);

    // Memoized calculations for current set, available players etc.
    const {
        nextEncounterIndex,
        availableTeam1Players,
        availableTeam2Players,
        encounterSize,
        playerSetCounts
    } = useMemo(() => {
        const defaults = { nextEncounterIndex: 0, availableTeam1Players: [], availableTeam2Players: [], encounterSize: 1, playerSetCounts: new Map() };
        if (!matchData?.team1?.players || !matchData?.team2?.players) {
            const encSize = matchData?.teamMatchEncounterFormat === 'Individual' ? 1 : 2;
            return { ...defaults, encounterSize: encSize };
        }
        const finishedEncounters = (matchData.teamMatchSubType === 'Relay' ? (matchData.score?.relayLegs || []) : (matchData.score?.setDetails || [])).filter(s => s.status === 'Finished');
        const nextIdx = finishedEncounters.length;
        const encSize = matchData.teamMatchEncounterFormat === 'Individual' ? 1 : 2;
        const pSetCounts = new Map();
        const rule = matchData.teamMatchSubType === 'Relay' ? 'playOnce' : 'playMaxSets';
        const maxSets = matchData.maxSetsPerPlayer || 2;
        finishedEncounters.forEach(detail => {
            const processPair = (pair) => (pair || []).forEach(p => {
                const pId = p?._id?.toString() || p?.toString();
                if (pId) pSetCounts.set(pId, (pSetCounts.get(pId) || 0) + 1);
            });
            processPair(detail.team1Players || detail.team1Pair);
            processPair(detail.team2Players || detail.team2Pair);
        });
        const filterAvailable = (teamPlayers) => (teamPlayers || []).filter(player => {
            if (!player?._id) return false;
            const playedCount = pSetCounts.get(player._id.toString()) || 0;
            if (rule === 'playOnce') return playedCount < 1;
            return playedCount < maxSets;
        });
        return {
            nextEncounterIndex: nextIdx,
            availableTeam1Players: filterAvailable(matchData.team1.players),
            availableTeam2Players: filterAvailable(matchData.team2.players),
            encounterSize: encSize,
            playerSetCounts: pSetCounts
        };
    }, [matchData]);



    // --- Unified Handler for Submitting Player Selections ---
    const handleSetupEncounter = async (values) => {
        setIsSubmitting(true);
        setFormError(null);
        const team1PairIds = Array.isArray(values.team1Players) ? values.team1Players : [values.team1Players].filter(Boolean);
        const team2PairIds = Array.isArray(values.team2Players) ? values.team2Players : [values.team2Players].filter(Boolean);
        if (team1PairIds.length !== encounterSize || team2PairIds.length !== encounterSize || !values.initialServer) {
            message.error("Please ensure all fields are selected correctly.");
            setIsSubmitting(false); return;
        }
        const endpoint = matchData.teamMatchSubType === 'Relay' ? 'setup_relay_leg' : 'setup_set';
        const payload = {
            setIndex: nextEncounterIndex,
            team1PairIds, team2PairIds,
            initialServer: values.initialServer
        };
        console.log(`Submitting to /${endpoint} with payload:`, payload);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/${endpoint}`, payload);
            setMatchData(response.data);
            pairSelectionForm.resetFields();
            message.success(`${matchData.teamMatchSubType} ${nextEncounterIndex + 1} started!`);
        } catch (error) {
            const errorMsg = error.response?.data?.message || `Failed to start ${matchData.teamMatchSubType}.`;
            setFormError(errorMsg);
            message.error(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };


    // --- Live Scoring and Undo Handlers ---
    const handleScoreUpdate = async (scoringTeam) => {
        if (isUpdatingScore || matchData?.status !== 'Live' || isUndoing) return;
        setIsUpdatingScore(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/score`, { scoringTeam });
            setMatchData(response.data);
            if (response.data.status !== 'Live') {
                message.info(`Set finished. Current overall score: ${response.data.score.currentSetScore.team1}-${response.data.score.currentSetScore.team2}`);
            }
            if (response.data.status === 'Finished') {
                let finalWinnerName = 'N/A';
                const winnerIdentifier = response.data.winner;
                if (response.data.matchType === 'Individual') { finalWinnerName = winnerIdentifier === response.data.player1?._id ? getTeamName(response.data, 1) : getTeamName(response.data, 2); }
                else { finalWinnerName = winnerIdentifier === 1 ? getTeamName(response.data, 1) : getTeamName(response.data, 2); }
                message.success(`Match finished! Winner: ${finalWinnerName}`);
            }
        } catch (error) {
            console.error("Error updating score:", error.response?.data || error.message);
            message.error(error.response?.data?.message || "Failed to update score.");
        } finally {
            setIsUpdatingScore(false);
        }
    };

    const handleUndo = async () => {
        if (isUndoing || isUpdatingScore || matchData?.status !== 'Live' || !matchData?.pointHistory?.length) {
            message.warning("Cannot undo point right now.");
            return;
        }
        setIsUndoing(true);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/undo`);
            setMatchData(response.data);
            message.success('Last point undone.');
        } catch (error) {
            console.error("Error undoing point:", error.response?.data || error.message);
            message.error(error.response?.data?.message || "Failed to undo point.");
        } finally {
            setIsUndoing(false);
        }
    };


    // --- Loading, Error, and No Data Render States ---
    if (loading) { return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" tip="Loading..." /></div>; }
    if (error) { return (<div style={{ padding: 20 }}> <Alert message="Error" description={error} type="error" showIcon /> <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginTop: 16 }}>Go Back</Button> </div>); }
    if (!matchData) { return (<div style={{ padding: 20 }}> <Alert message="Match data not found." type="warning" showIcon /> <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginTop: 16 }}>Go Back</Button> </div>); }

    const { status, teamMatchSubType } = matchData;
    const isAwaitingSetup = status === 'Upcoming' || status === 'AwaitingSubMatchSetup' || status === 'AwaitingTiebreakerPairs';
    const isLive = status === 'Live';
    const isFinished = status === 'Finished';
    const canUndo = isLive && matchData?.pointHistory?.length > 0;

    // --- UI for Player/Pair Selection (Unified for both Set and Relay) ---
    const renderEncounterSelectionForm = () => {
        const encounterLabel = teamMatchSubType === 'Relay' ? 'Leg' : 'Set';
        const nextEncounterNumber = nextEncounterIndex + 1;
        const formTitle = status === 'AwaitingTiebreakerPairs' ? 'Select Pairs for Tiebreaker' : `Select Players for ${encounterLabel} ${nextEncounterNumber}`;
        const getPlayerLabel = (player) => {
            if (!player?._id) return '';
            if (teamMatchSubType === 'Relay') return player.name;
            const playedCount = playerSetCounts.get(player._id.toString()) || 0;
            const maxSets = matchData?.maxSetsPerPlayer || 2;
            const remaining = maxSets - playedCount;
            return `${player.name} (${remaining} set${remaining !== 1 ? 's' : ''} left)`;
        };
        return (
            <Card title={<Title level={4}>{formTitle}</Title>} style={{ marginTop: 20 }}>
                {formError && <Alert message={`Error Starting ${encounterLabel}`} description={formError} type="error" showIcon closable onClose={()=>setFormError(null)} style={{marginBottom:16}}/>}
                <Form form={pairSelectionForm} layout="vertical" onFinish={handleSetupEncounter} onFinishFailed={(err) => console.log('Validation Failed:', err)}>
                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Title level={5}>{getTeamName(matchData, 1)}</Title>
                            <Form.Item name="team1Players" label={`Select ${encounterSize} Player(s)`} rules={[{ required: true, message: `Please select player(s).` }]}>
                                <Select mode={encounterSize > 1 ? "multiple" : undefined} placeholder={`Select player${encounterSize > 1 ? 's' : ''}`} allowClear options={(availableTeam1Players).map(p => ({ value: p._id, label: getPlayerLabel(p) }))} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Title level={5}>{getTeamName(matchData, 2)}</Title>
                            <Form.Item name="team2Players" label={`Select ${encounterSize} Player(s)`} rules={[{ required: true, message: `Please select player(s).` }]}>
                                <Select mode={encounterSize > 1 ? "multiple" : undefined} placeholder={`Select player${encounterSize > 1 ? 's' : ''}`} allowClear options={(availableTeam2Players).map(p => ({ value: p._id, label: getPlayerLabel(p) }))} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="initialServer" label={`Who Serves First in this ${encounterLabel}?`} rules={[{ required: true }]}>
                        <Radio.Group> <Radio value={1}>{getTeamName(matchData, 1)}</Radio> <Radio value={2}>{getTeamName(matchData, 2)}</Radio> </Radio.Group>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={isSubmitting} block> Confirm Players & Start {encounterLabel} {nextEncounterNumber} </Button>
                    </Form.Item>
                </Form>
            </Card>
        );
    };

    // --- Main Scoreboard Display (Live scoring UI) ---
    // --- UI for Live Scoring (Router) ---
    const renderLiveScoreboard = () => {
        // --- 'Set' Match Live UI ---
        if (teamMatchSubType === 'Set') {
            const currentLiveSetDetail = matchData.score?.setDetails?.find(s => s.status === 'Live');
            if (!currentLiveSetDetail) return <Alert message="Waiting for next set setup..." type="info" showIcon />;
            const currentSetNumberForDisplay = (matchData.score?.setDetails?.filter(s => s.status === 'Finished').length || 0) + 1;
            const team1PlayingPair = (currentLiveSetDetail.team1Pair || []).map(pIdObj => matchData.team1?.players.find(p => p._id === (pIdObj._id || pIdObj))).filter(Boolean);
            const team2PlayingPair = (currentLiveSetDetail.team2Pair || []).map(pIdObj => matchData.team2?.players.find(p => p._id === (pIdObj._id || pIdObj))).filter(Boolean);
            const team1PlayingNames = team1PlayingPair.map(p => p.name).join(' & ');
            const team2PlayingNames = team2PlayingPair.map(p => p.name).join(' & ');
            return (
                <Card title={<Title level={4} style={{ textAlign: 'center' }}>Live Scoring</Title>} style={{ marginTop: 20 }}>
                    <Title level={5} style={{ textAlign: 'center' }}>Set {currentSetNumberForDisplay}: {team1PlayingNames} vs {team2PlayingNames}</Title>
                    <Row justify="space-around" align="top" gutter={[16, 24]} style={{ marginBottom: 24, textAlign: 'center' }}>
                        <Col xs={24} sm={10}>
                            <Space direction="vertical" align="center" size="middle">
                                {renderCurrentPairAvatars(team1PlayingPair, matchData.score.server === 1)}
                                <Space align="center" size="large">
                                    <Avatar size={100} src={matchData.team1?.logoUrl ? `${API_URL}${matchData.team1.logoUrl}` : undefined} icon={<UserOutlined />} />
                                </Space>
                                <Title level={4} style={{ marginBottom: 0, marginTop: 8 }}>{getTeamName(matchData, 1)}</Title>
                                <Statistic title="Overall Sets Won" value={matchData.score?.currentSetScore?.team1 ?? 0} />
                            </Space>
                        </Col>
                        <Col xs={24} sm={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', minHeight: '150px' }}>vs</Col>
                        <Col xs={24} sm={10}>
                            <Space direction="vertical" align="center" size="middle">
                                {renderCurrentPairAvatars(team2PlayingPair, matchData.score.server === 2)}
                                <Space align="center" size="large">
                                    <Avatar size={100} src={matchData.team2?.logoUrl ? `${API_URL}${matchData.team2.logoUrl}` : undefined} icon={<UserOutlined />} />
                                </Space>
                                <Title level={4} style={{ marginBottom: 0, marginTop: 8 }}>{getTeamName(matchData, 2)}</Title>
                                <Statistic title="Overall Sets Won" value={matchData.score?.currentSetScore?.team2 ?? 0} />
                            </Space>
                        </Col>
                    </Row>
                    <Divider>Current Game in Set {currentSetNumberForDisplay}</Divider>
                    <Row justify="space-around" align="middle" gutter={[16, 16]} style={{ marginBottom: 24, textAlign: 'center' }}>
                        <Col xs={24} md={10}>
                            <Statistic value={matchData.score?.currentGame?.team1 ?? 0} valueStyle={{ fontSize: '3.5rem' }} />
                            {!isFinished && (<Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(1)} loading={isUpdatingScore || isUndoing} disabled={isUndoing || isFinished} style={{ marginTop: 8 }} block>Point Team 1</Button>)}
                        </Col>
                        <Col xs={0} md={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', color: '#aaa' }}>-</Col>
                        <Col xs={24} md={10}>
                            <Statistic value={matchData.score?.currentGame?.team2 ?? 0} valueStyle={{ fontSize: '3.5rem' }} />
                            {!isFinished && (<Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(2)} loading={isUpdatingScore || isUndoing} disabled={isUndoing || isFinished} style={{ marginTop: 8 }} block>Point Team 2</Button>)}
                        </Col>
                    </Row>
                    {matchData.score?.setDetails && matchData.score.setDetails.filter(s => s.status === 'Finished').length > 0 && (
                        <>
                            <Divider>Completed Sets</Divider>
                            <List
                                size="small"
                                bordered
                                dataSource={matchData.score.setDetails.filter(s => s.status === 'Finished')}
                                renderItem={(set, index) => (
                                    <List.Item>
                                        <Text strong style={{ marginRight: 'auto' }}>Set {index + 1}:</Text>
                                        <Text>{set.team1Score} - {set.team2Score}</Text>
                                    </List.Item>
                                )}
                                style={{ maxWidth: 300, margin: '24px auto 0 auto' }}
                            />
                        </>
                    )}
                </Card>
            );
        }

        // --- 'Relay' Match Live UI ---
        if (matchData.teamMatchSubType === 'Relay') {
            const currentLeg = matchData.score?.relayLegs?.find(l => l.status === 'Live');
            if (!currentLeg) return <Alert message="Waiting for next leg setup..." type="info" showIcon />;

            const currentLegNumber = currentLeg.legNumber;
            const legTargetScore = (matchData.setPointTarget || 10) * currentLegNumber;
            const finalTargetScore = (matchData.setPointTarget || 10) * (matchData.numberOfSets || 1);

            // --- DEFINE THE PLAYING PAIR VARIABLES HERE ---
            const team1PlayingPair = (currentLeg.team1Players || []).map(pId =>
                matchData.team1?.players.find(p => p._id === (pId._id || pId))
            ).filter(Boolean);
            const team2PlayingPair = (currentLeg.team2Players || []).map(pId =>
                matchData.team2?.players.find(p => p._id === (pId._id || pId))
            ).filter(Boolean);

            return (
                <Card title={<Title level={4}>Live Relay Scoring - Leg {currentLegNumber}</Title>} style={{ marginTop: 20 }}>
                    <Row justify="space-around" align="top" gutter={[16, 24]} style={{ marginBottom: 24, textAlign: 'center' }}>
                        <Col xs={24} sm={10}>
                            <Space direction="vertical" align="center" size="middle">
                                {renderCurrentPairAvatars(team1PlayingPair, matchData.score.server === 1)}
                                <Space align="center" size="large">
                                    <Avatar size={100} src={matchData.team1?.logoUrl ? `${API_URL}${matchData.team1.logoUrl}` : undefined} icon={<UserOutlined />} />

                                </Space>
                                <Title level={4} style={{ marginBottom: 0, marginTop: 8 }}>{getTeamName(matchData, 1)}</Title>
                            </Space>
                        </Col>
                        <Col xs={24} sm={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', minHeight: '150px' }}>
                            <Statistic title="Final Target" value={finalTargetScore} />
                        </Col>
                        <Col xs={24} sm={10}>
                            <Space direction="vertical" align="center" size="middle">
                                {renderCurrentPairAvatars(team2PlayingPair, matchData.score.server === 2)}
                                <Space align="center" size="large">
                                    <Avatar size={100} src={matchData.team2?.logoUrl ? `${API_URL}${matchData.team2.logoUrl}` : undefined} icon={<UserOutlined />} />

                                </Space>
                                <Title level={4} style={{ marginBottom: 0, marginTop: 8 }}>{getTeamName(matchData, 2)}</Title>
                            </Space>
                        </Col>
                    </Row>
                    <Divider>Overall Score (Leg Target: {legTargetScore})</Divider>
                    <Row justify="space-around" align="middle" gutter={16}>
                        <Col span={10} style={{ textAlign: 'center' }}>
                            <Statistic value={matchData.score.overallScore?.team1 ?? 0} valueStyle={{ fontSize: '4rem' }} />
                            {!isFinished && <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(1)} loading={isUpdatingScore || isUndoing} disabled={isUndoing || isFinished} block>Point</Button>}
                        </Col>
                        <Col span={4} style={{ textAlign: 'center', fontSize: '3rem', color: '#aaa' }}>

                        </Col>
                        <Col span={10} style={{ textAlign: 'center' }}>
                            <Statistic value={matchData.score.overallScore?.team2 ?? 0} valueStyle={{ fontSize: '4rem' }} />
                            {!isFinished && <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => handleScoreUpdate(2)} loading={isUpdatingScore || isUndoing} disabled={isUndoing || isFinished} block> Point</Button>}
                        </Col>
                    </Row>
                </Card>
            );
        }
        return <Alert message="Unknown Live Match Type" type="error" />;
    };

    const renderFinishedMatch = () => {
        const winningTeamData = matchData.winner === 1 ? matchData.team1 : matchData.team2;
        const winnerName = winningTeamData?.name || 'N/A';
        const winnerLogoUrl = winningTeamData?.logoUrl ? `${API_URL}${winningTeamData.logoUrl}` : undefined;

        return (
            <Result
                icon={<TrophyOutlined style={{ color: '#52c41a' }} />}
                title={<Title level={2} style={{ color: '#52c41a' }}>Congratulations, {winnerName}!</Title>}
                subTitle="You have won the match."
                extra={[
                    <Title level={4} key="final-score">
                        {matchData.teamMatchSubType === 'Set'
                            ? `Final Set Score: ${matchData.score?.currentSetScore?.team1 ?? 0} - ${matchData.score?.currentSetScore?.team2 ?? 0}`
                            : `Final Score: ${matchData.score?.overallScore?.team1 ?? 0} - ${matchData.score?.overallScore?.team2 ?? 0}`
                        }
                    </Title>,
                    <Avatar
                        key="winner-logo"
                        size={128} 
                        src={winnerLogoUrl}
                        icon={!winnerLogoUrl ? <UserOutlined /> : null}
                        style={{ marginTop: 24, border: '4px solid #f6ffed' }}
                    />,
                    
                ]}
                style={{
                    padding: '48px 0'
                }}
            />
            

        );
    };

    // --- Main Return for TeamScoreboard ---
    return (
        <Card>
            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                <Col><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/team-matches')}>Back to Team Matches</Button></Col>
                <Col>
                    {isLive && (
                        <Button icon={<UndoOutlined />} onClick={handleUndo} disabled={!canUndo || isSubmitting} loading={isUndoing}>Undo Last Point</Button>
                    )}
                </Col>
            </Row>
            <Title level={3} style={{ textAlign: 'center' }}>Team Match Scoreboard ({teamMatchSubType})</Title>
            <Text block style={{ textAlign: 'center' }}>Match ID: {matchId}</Text>
            <Tag color="blue" style={{ display: 'block', textAlign: 'center', marginBottom: 24, fontSize: '1rem' }}> Status: {status} </Tag>

            {isAwaitingSetup && renderEncounterSelectionForm()}
            {isLive && renderLiveScoreboard()}
            {isFinished && renderFinishedMatch()}

            {/* 
            <Divider>Debug: Raw Match Data</Divider>
            <pre style={{ fontSize: '0.8em', background: '#f5f5f5', padding: '10px', borderRadius: '4px', marginTop: 20, maxHeight: 300, overflowY: 'auto' }}>
                {JSON.stringify(matchData, null, 2)}
            </pre>
            */}
        </Card>
    );
};


export default TeamScoreboard;