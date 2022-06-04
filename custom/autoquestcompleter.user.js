// ==UserScript==
// @name        [Pokeclicker] Auto Quest Completer
// @namespace   Pokeclicker Scripts
// @match       https://www.pokeclicker.com/
// @grant       none
// @version     1.2
// @author      KarmaAlex (Credit: Ephenia, Sorrow)
// @description Removes the limit for the number of quests you can do at once and auto completes/starts new ones.
// @updateURL   https://raw.githubusercontent.com/Ephenia/Pokeclicker-Scripts/master/custom/autoquestcompleter.user.js
// ==/UserScript==

let questTypes = [];
let autoQuestCanBeStopped;
let questLocationReadyToStart = false;
let questLocationInProgress = false;
let completeQuestLocationLoop;
let questPokeballReadyToStart = false;
let questPokeballInProgress = false;
let completeQuestPokeballLoop;
let questCapturePokemonsReadyToStart = false;
let questCapturePokemonsInProgress = false;
let completeQuestCapturePokemonsLoop;
let questCapturePokemonTypesReadyToStart = false;
let questCapturePokemonTypesInProgress = false;
let completeQuestCapturePokemonTypesLoop;
let pokeballChangedForCapturePokemonQuest = false;
let regionSelect;
let subRegionSelect;
let routeSelect;
let townSelect;
let dungeonStateSelect;
let gymStateSelect;
let pokeballAlreadyCaughtSelect;
let previousPokeballAlreadyCaughtSelect;
let hatcheryCategorySelect;
let hatcheryShinyStatusSelect;
let hatcheryRegionSelect;
let hatcheryType1Select;
let hatcheryType2Select;
let hatcherySortSelect;
let hatcherySortDirectionSelect;
let hatcheryStateSelect;
let dungeonQuestEnable;
let gymStart;
let dungeonStart;
let hatcheryStart;

function initAutoQuests(){
    //Allows to start infinite  quests
    App.game.quests.canStartNewQuest = function(){
        return true;
    }
    //Create localStorage variable to enable/disable auto quests
    if (localStorage.getItem('autoQuestEnable') == null){
        localStorage.setItem('autoQuestEnable', 'true')
    }
    //Define quest types
    if (localStorage.getItem('autoQuestTypes') == null){
        for (const type in QuestHelper.quests) {
            questTypes.push(type);
        }
        localStorage.setItem('autoQuestTypes', JSON.stringify(questTypes))
    } else {
        questTypes = JSON.parse(localStorage.getItem('autoQuestTypes'));
        dungeonQuestEnable = questTypes.includes("DefeatDungeonQuest");
    }
    resetQuestModify();
    //Track the last refresh
    let trackRefresh = App.game.quests.lastRefresh;
    //Add button
    var autoQuestBtn = document.createElement('button')
    autoQuestBtn.id = 'toggle-auto-quest'
    autoQuestBtn.className = localStorage.getItem('autoQuestEnable') == 'true' ? 'btn btn-block btn-success' : 'btn btn-block btn-danger'
    autoQuestBtn.style = 'position: absolute; left: 0px; top: 0px; width: auto; height: 41px; font-size: 9px;'
    autoQuestBtn.textContent = localStorage.getItem('autoQuestEnable') == 'true' ? 'Auto [ON]' : 'Auto [OFF]'
    document.getElementById('questDisplayContainer').appendChild(autoQuestBtn)
    //Add function to toggle auto quests
    document.getElementById('toggle-auto-quest').addEventListener('click',() => {
        if (localStorage.getItem('autoQuestEnable') == 'true'){
            localStorage.setItem('autoQuestEnable', 'false')
            document.getElementById('toggle-auto-quest').className = 'btn btn-block btn-danger'
            document.getElementById('toggle-auto-quest').textContent = 'Auto [OFF]'
        }
        else{
            localStorage.setItem('autoQuestEnable', 'true')
            document.getElementById('toggle-auto-quest').className = 'btn btn-block btn-success'
            document.getElementById('toggle-auto-quest').textContent = 'Auto [ON]'
        }
    }, false)
    //Retrieving autoclicker buttons
    gymStart = document.getElementById("auto-gym-start");
    dungeonStart = document.getElementById("auto-dungeon-start");
    hatcheryStart = document.getElementById("auto-hatch-start");

    //Checks for new quests to add to the list and claims completed ones
    var autoQuest = setInterval(function(){
        let questsNeed = 0;
        if (trackRefresh != App.game.quests.lastRefresh) {
            trackRefresh = App.game.quests.lastRefresh;
            stopCompleteQuestLocation();
            //Reload quest types from local storage to re-enter the dungeon if they are deleted because there are not enough dungeon tokens left.
            questTypes = JSON.parse(localStorage.getItem('autoQuestTypes'));
            resetQuestModify();
        }
        if (localStorage.getItem('autoQuestEnable') == 'true'){
            autoQuestCanBeStopped = true;
            //Attempt to start all available quests & quit the filtered ones
            App.game.quests.questList().forEach(quest => {
                if (quest.inProgress() == true && !questTypes.includes(quest.constructor.name)) {
                    App.game.quests.quitQuest(quest.index);
                } else if (quest.isCompleted() == false && quest.inProgress() == false && questTypes.includes(quest.constructor.name)){
                    App.game.quests.beginQuest(quest.index);
                }
            })
            if (App.game.quests.currentQuests().length > 0){
                App.game.quests.currentQuests().forEach(quest => {
                    if (quest.notified == true){
                        //Claim all completed quest
                        App.game.quests.claimQuest(quest.index)
                    } else {
                        //Processes quests with location
                        if(!questLocationInProgress) {
                            if(quest instanceof DefeatGymQuest) {
                                completeDefeatGymQuest(quest)
                            } else if(quest instanceof DefeatPokemonsQuest) {
                                completeDefeatPokemonQuest(quest)
                            } else if(quest instanceof DefeatDungeonQuest) {
                                completeDefeatDungeonQuest(quest)
                            }
                        }
                        if (!questCapturePokemonsInProgress) {
                            if (quest instanceof CapturePokemonsQuest) {
                                completeCapturePokemonsQuest(quest)
                            }
                        }
                        if (!questCapturePokemonTypesInProgress) {
                            if (quest instanceof CapturePokemonTypesQuest) {
                                completeCapturePokemonTypesQuest(quest)
                            }
                        }
                        if (!questPokeballInProgress) {
                            if (quest instanceof UsePokeballQuest) {
                                completeUsePokeballQuest(quest)
                            }
                        }
                    }
                    //Complete quest when you use pokeball to capture pokemon like shiny and type
                    if (App.game.gameState === GameConstants.GameState.fighting) {
                        changePokeballForPokemonQuest()
                    }

                    //Check if quests should refresh
                    if (questTypes.includes(quest.constructor.name)) {
                        questsNeed++;
                    }
                })
            } else if (App.game.quests.currentQuests().length == 0) {
                //Quest refresh handling
                if (questsNeed == 0 && App.game.quests.canAffordRefresh()) {
                    App.game.quests.refreshQuests();
                }
            }
        } else if (autoQuestCanBeStopped) {
            autoQuestCanBeStopped = false;
            endCapturePokemonsQuest();
            endCapturePokemonTypesQuest();
            endPokeballQuest();
            stopCompleteQuestLocation();
        }
    }, 500)

    function resetQuestModify() {
        //Selecting Quest list in Quest Modal and adding click listeners
        const questHTML = document.getElementById('QuestModal').querySelector('tbody').children;
        for (let i = 0; i < questHTML.length; i++) {
            questHTML[i].querySelector('td:nth-child(1)').setAttribute('data-src', i);
            questHTML[i].addEventListener('click', () => {retrieveQuestName(event)})
        }
    }

    function retrieveQuestName(event) {
        const index = +event.target.getAttribute('data-src');
        const quest = App.game.quests.questList()[index];
        const questName = quest.constructor.name
        const indexPos = questTypes.indexOf(questName);
        if (indexPos != -1) {
            questTypes[indexPos] = null;
        } else if (indexPos == -1) {
            const empty = questTypes.indexOf(null);
            questTypes[empty] = questName;
        }

        //Stop current quests in progress
        if(questLocationInProgress && (quest instanceof DefeatGymQuest || quest instanceof DefeatPokemonsQuest || quest instanceof DefeatDungeonQuest)) {
            stopCompleteQuestLocation();
        } else if (questCapturePokemonsInProgress && quest instanceof CapturePokemonsQuest) {
            endCapturePokemonsQuest();
        } else if (questCapturePokemonTypesInProgress && quest instanceof CapturePokemonTypesQuest) {
            endCapturePokemonTypesQuest();
        } else if (questPokeballInProgress && quest instanceof UsePokeballQuest) {
            endPokeballQuest();
        }
        localStorage.setItem('autoQuestTypes', JSON.stringify(questTypes));
    }

    function stopCompleteQuestLocation() {
        if(questLocationInProgress) {
            //Reset loop when quest is refreshed or auto quest is disabled
            if(typeof completeQuestLocationLoop !== 'undefined') {
                clearInterval(completeQuestLocationLoop);
                completeQuestLocationLoop = null;
            }
            stopAutoDungeon();
            stopAutoGym();
            let resetPlayerStateLoop = setInterval(function() {
                if(playerCanMove()) {
                    playerResetState();
                    clearInterval(resetPlayerStateLoop);
                }
            }, 50);
            questLocationInProgress = false;
        }
        questLocationReadyToStart = false;
    }
}

function loadScript(){
    var oldInit = Preload.hideSplashScreen

    Preload.hideSplashScreen = function(){
        var result = oldInit.apply(this, arguments)
        initAutoQuests()
        return result
    }
}

var scriptName = 'autoquestcomplete'

if (document.getElementById('scriptHandler') != undefined){
    var scriptElement = document.createElement('div')
    scriptElement.id = scriptName
    document.getElementById('scriptHandler').appendChild(scriptElement)
    if (localStorage.getItem(scriptName) != null){
        if (localStorage.getItem(scriptName) == 'true'){
            loadScript()
        }
    }
    else{
        localStorage.setItem(scriptName, 'true')
        loadScript()
    }
}
else{
    loadScript();
}

function removeQuestTemporarily(quest) {
    const indexPos = questTypes.indexOf(quest.constructor.name);
    if (indexPos !== -1) {
        questTypes[indexPos] = null;
    }
}

function completeDefeatDungeonQuest(dungeonQuest) {
    //Can't farm the dungeons without the autoclicker
    if(!dungeonStart) return;

    //Remove dungeon quest for current cycle if total token needed not available
    if(!playerCanPayDungeonEntrance(dungeonQuest.dungeon, dungeonQuest.progressText())) {
        removeQuestTemporarily(dungeonQuest);
        endLocationQuest();
        return;
    }

    if(!questLocationReadyToStart) {
        playerSaveState();
        stopAutoGym();
        questLocationReadyToStart = true;
    }

    //Move player to quest dungeon
    if (playerCanMove()) {
        playerMoveToTown(dungeonQuest.dungeon, dungeonQuest.region);
    }

    if(player.town().name === dungeonQuest.dungeon) {
        questLocationInProgress = true;
        completeQuestLocationLoop = setInterval(function() {
            if(!dungeonQuest.notified) {
                if(dungeonStart && !dungeonStart.classList.contains("btn-success")) {
                    dungeonStart.click();
                }
            } else if(playerCanMove()) {
                endLocationQuest();
            }
        }, 50);
    }
}

function completeDefeatGymQuest(gymQuest) {
    //Find town associate to gym
    const gymListAsArray = Object.entries(GymList);
    const town = gymListAsArray.filter(([key, value]) => key === gymQuest.gymTown)[0][1];

    if(!questLocationReadyToStart) {
        playerSaveState();
        stopAutoDungeon();
        stopAutoGym();
        questLocationReadyToStart = true;
    }
    //Move player to quest town
    if (playerCanMove()) {
        playerMoveToTown(town.parent.name, town.parent.region);
    }

    if(player.town().name === town.parent.name) {
        //Find gym in town
        for(const gym of player.town().content) {
            if(gym.town === gymQuest.gymTown) {
                questLocationInProgress = true;
                completeQuestLocationLoop = setInterval(function() {
                    if(!gymQuest.notified) {
                        if(App.game.gameState !== GameConstants.GameState.gym) {
                            gym.protectedOnclick();
                        }
                    } else if(playerCanMove()) {
                        endLocationQuest();
                    }
                }, 50);
            }
        }
    }
}

function completeDefeatPokemonQuest(pokemonQuest) {
    if(!questLocationReadyToStart) {
        playerSaveState();
        stopAutoDungeon();
        stopAutoGym();
        questLocationReadyToStart = true;
    }

    //Move player to quest route
    if (playerCanMove()) {
        playerMoveToRoute(pokemonQuest.route, pokemonQuest.region);
    }

    if(player.route() === pokemonQuest.route && player.region === pokemonQuest.region) {
        questLocationInProgress = true;
        completeQuestLocationLoop = setInterval(function() {
            if(pokemonQuest.notified) {
                endLocationQuest();
            }
        }, 50);
    }
}

function endLocationQuest() {
    //Executed when the quest is completed
    questLocationReadyToStart = false;
    questLocationInProgress = false;
    clearInterval(completeQuestLocationLoop);
    completeQuestLocationLoop = null;
    stopAutoDungeon();
    stopAutoGym();
    playerResetState();
}

function completeUsePokeballQuest(pokeballQuest) {
    if (!questPokeballInProgress) {
        //Remove use pokeball quest for current cycle if total pokeball needed not available
        if(!playerHasPokeballForPokemonQuest(pokeballQuest.pokeball, pokeballQuest.progressText())) {
            removeQuestTemporarily(pokeballQuest);
            endPokeballQuest();
            return;
        }

        questPokeballInProgress = true;

        //Save and set pokeball already caught selection
        if (!questPokeballReadyToStart) {
            playerSavePokeballAlreadyCaught();
        }
        playerSetAlreadyCaughtPokeball(pokeballQuest.pokeball)

        completeQuestPokeballLoop = setInterval(function() {
            if(pokeballQuest.notified) {
                endPokeballQuest()
            }
        }, 1000);
    }
}

function endPokeballQuest() {
    //Executed when the quest is completed
    questPokeballInProgress = false;
    clearInterval(completeQuestPokeballLoop);
    completeQuestPokeballLoop = null;
    if (questPokeballReadyToStart) {
        playerSetAlreadyCaughtPokeball(pokeballAlreadyCaughtSelect);
        questPokeballReadyToStart = false;
    }
}

function completeCapturePokemonsQuest(captureQuest) {
    //Can't use hatchery without autohatchery
    if(!hatcheryStart) return;

    //No need to run the code if autohatchery is enabled
    if(hatcheryStart.classList.contains("btn-success")) {
        return;
    }

    if(!questCapturePokemonsReadyToStart) {
        if (!questCapturePokemonTypesInProgress) {
            playerSaveHatcheryState();
        }
        questCapturePokemonsReadyToStart = true;
    }

    if (!questCapturePokemonsInProgress) {
        questCapturePokemonsInProgress = true;
        if (!questCapturePokemonTypesInProgress) {
            //Set all filter breeding to default to avoid empty list
            BreedingController.filter.category(-1)
            BreedingController.filter.shinyStatus(-2)
            BreedingController.filter.region(-2)
            BreedingController.filter.type1(-2)
            BreedingController.filter.type2(-2)
            Settings.getSetting('hatcherySort').observableValue(6) // Breeding efficient
            Settings.getSetting('hatcherySortDirection').observableValue(true)
        }

        completeQuestCapturePokemonsLoop = setInterval(function() {
            if(!captureQuest.notified) {
                if(hatcheryStart.classList.contains("btn-danger")) {
                    hatcheryStart.click();
                }
            } else {
                endCapturePokemonsQuest()
            }
        }, 5000);
    }
}

function endCapturePokemonsQuest() {
    questCapturePokemonsReadyToStart = false;
    questCapturePokemonsInProgress = false;
    clearInterval(completeQuestCapturePokemonsLoop)
    completeQuestCapturePokemonsLoop = null;
    if (!questCapturePokemonTypesInProgress) {
        playerResetHatcheryState()
    }
}

function completeCapturePokemonTypesQuest(captureQuest) {
    //Can't use hatchery without autohatchery
    if(!hatcheryStart) return;

    if(!questCapturePokemonTypesReadyToStart) {
        if (!questCapturePokemonsReadyToStart) {
            playerSaveHatcheryState();
        }
        questCapturePokemonTypesReadyToStart = true;
    }

    if (!questCapturePokemonTypesInProgress) {
        questCapturePokemonTypesInProgress = true;
        //Set all filter breeding to default to avoid empty list
        BreedingController.filter.category(-1)
        BreedingController.filter.shinyStatus(-2)
        BreedingController.filter.region(-2)
        BreedingController.filter.type1(captureQuest.type)
        BreedingController.filter.type2(-2)
        Settings.getSetting('hatcherySort').observableValue(6) // Breeding efficient
        Settings.getSetting('hatcherySortDirection').observableValue(true)

        completeQuestCapturePokemonTypesLoop = setInterval(function() {
            if(!captureQuest.notified) {
                if(hatcheryStart.classList.contains("btn-danger")) {
                    hatcheryStart.click();
                }
            } else {
                endCapturePokemonTypesQuest()
            }
        }, 5000);
    }
}

function endCapturePokemonTypesQuest() {
    questCapturePokemonTypesReadyToStart = false;
    questCapturePokemonTypesInProgress = false;
    clearInterval(completeQuestCapturePokemonTypesLoop)
    completeQuestCapturePokemonTypesLoop = null;
    if (!questCapturePokemonsInProgress) {
        playerResetHatcheryState()
    } else {
        //Set type1 to all if pokemon quest capture is in progress
        BreedingController.filter.type1(-2)
    }
}

function changePokeballForPokemonQuest() {
    let catchShiniesQuest = App.game.quests.currentQuests().filter(x => x instanceof CatchShiniesQuest);
    let capturePokemonTypesQuest = App.game.quests.currentQuests().filter(x => x instanceof CapturePokemonTypesQuest);

    let forceCapture = false;
    if (App.game.pokeballs.alreadyCaughtSelection < GameConstants.Pokeball.Ultraball || pokeballChangedForCapturePokemonQuest) {
        if (catchShiniesQuest.length > 0) {
            if (Battle.enemyPokemon().shiny || DungeonBattle.enemyPokemon().shiny) {
                forceCapture = true;
            }
        }
        if (capturePokemonTypesQuest.length > 0) {
            for(const quest of capturePokemonTypesQuest) {
                //Check if pokemon type is catchable
                if(quest.type === Battle.enemyPokemon().type1 || quest.type === Battle.enemyPokemon().type2) {
                    forceCapture = true;
                    break;
                }
            }
        }

        if (forceCapture) {
            //Check if player have pokeball to catch pokemon
            let pokeball = -1;
            for (let i = GameConstants.Pokeball.Ultraball; i >= 0; i--) {
                if(playerHasPokeballForPokemonQuest(i)) {
                    pokeball = i;
                    break;
                }
            }
            if (pokeball === -1) {
                removeQuestTemporarily(quest);
                return;
            }
            if (!pokeballChangedForCapturePokemonQuest) {
                playerSavePreviousPokeballAlreadyCaught();
            }
            playerSetAlreadyCaughtPokeball(pokeball)
        } else if (pokeballChangedForCapturePokemonQuest) {
            playerSetAlreadyCaughtPokeball(previousPokeballAlreadyCaughtSelect)
            pokeballChangedForCapturePokemonQuest = false;
        }
    }
}

function playerSaveState() {
    //Save last location of player in temp variable
    regionSelect = player.region;
    subRegionSelect = player.subregion;
    routeSelect = player.route();
    townSelect = player.town().name;

    if(dungeonStart && dungeonStart.classList.contains("btn-danger")) {
        dungeonStateSelect = false;
    } else if(dungeonStart && dungeonStart.classList.contains("btn-success")) {
        dungeonStateSelect = true;
    }
    if(gymStart && gymStart.classList.contains("btn-danger")) {
        gymStateSelect = false;
    } else if(gymStart && gymStart.classList.contains("btn-success")) {
        gymStateSelect = true;
    }
}

function playerSavePokeballAlreadyCaught() {
    pokeballAlreadyCaughtSelect = App.game.pokeballs.alreadyCaughtSelection;
    questPokeballReadyToStart = true;
}

function playerSavePreviousPokeballAlreadyCaught() {
    previousPokeballAlreadyCaughtSelect = App.game.pokeballs.alreadyCaughtSelection;
    pokeballChangedForCapturePokemonQuest = true;
}

function playerSaveHatcheryState() {
    hatcheryCategorySelect = BreedingController.filter.category()
    hatcheryShinyStatusSelect = BreedingController.filter.shinyStatus()
    hatcheryRegionSelect = BreedingController.filter.region()
    hatcheryType1Select = BreedingController.filter.type1()
    hatcheryType2Select = BreedingController.filter.type2()
    hatcherySortSelect = Settings.getSetting('hatcherySort').observableValue()
    hatcherySortDirectionSelect = Settings.getSetting('hatcherySortDirection').observableValue()

    if(hatcheryStart && hatcheryStart.classList.contains("btn-danger")) {
        hatcheryStateSelect = false;
    } else if(hatcheryStart && hatcheryStart.classList.contains("btn-success")) {
        hatcheryStateSelect = true;
    }
}

function playerResetHatcheryState() {
    BreedingController.filter.category(hatcheryCategorySelect)
    BreedingController.filter.shinyStatus(hatcheryShinyStatusSelect)
    BreedingController.filter.region(hatcheryRegionSelect)
    BreedingController.filter.type1(hatcheryType1Select)
    BreedingController.filter.type2(hatcheryType2Select)
    Settings.getSetting('hatcherySort').observableValue(hatcherySortSelect)
    Settings.getSetting('hatcherySortDirection').observableValue(hatcherySortDirectionSelect)
    if (hatcheryStart) {
        if(hatcheryStateSelect && !hatcheryStart.classList.contains("btn-success")) {
            hatcheryStart.click();
        } else if(!hatcheryStateSelect && !hatcheryStart.classList.contains("btn-danger")) {
            hatcheryStart.click();
        }
    }
}

function playerResetState() {
    if(regionSelect && player.region !== regionSelect) {
        player.region = regionSelect;
    }
    if(subRegionSelect && player.subregion !== subRegionSelect) {
        player.subregion = subRegionSelect;
    }
    if(routeSelect && player.route() !== routeSelect) {
        MapHelper.moveToRoute(routeSelect, regionSelect);
    }
    if(townSelect && routeSelect === 0) {
        MapHelper.moveToTown(townSelect);
    }
    if (dungeonStart) {
        if(dungeonStateSelect && !dungeonStart.classList.contains("btn-success")) {
            dungeonStart.click();
        } else if(!dungeonStateSelect && !dungeonStart.classList.contains("btn-danger")) {
            dungeonStart.click();
        }
    }
    if (gymStart) {
        if(gymStateSelect && !gymStart.classList.contains("btn-success")) {
            gymStart.click();
        } else if(!gymStateSelect && !gymStart.classList.contains("btn-danger")) {
            gymStart.click();
        }
    }
}

function playerCanMove() {
    return !DungeonRunner.fighting() && !DungeonRunner.fightingBoss() && !DungeonBattle.catching() && !GymRunner.running()
}

function playerMoveToTown(town, region) {
    if(player.region !== region || player.town().name !== town) {
        player.region = region;
        if(region === 6) {
            setAlolaSubRegion(town)
        } else {
            player.subregion = 0
        }
        MapHelper.moveToTown(town);
    }
}

function playerMoveToRoute(route, region) {
    if(player.region !== region || player.route() !== route) {
        player.region = region;
        if(region === 6) {
            setAlolaSubRegion(route)
        } else {
            player.subregion = 0
        }
        MapHelper.moveToRoute(route, region);
    }
}

function playerCanPayDungeonEntrance(dungeonName, progressText) {
    const dungeon = Object.entries(TownList).filter(([key, value]) => key === dungeonName)[0][1].dungeon
    let getTokens = App.game.wallet.currencies[GameConstants.Currency.dungeonToken]();
    let dungeonCost = dungeon.tokenCost;
    let progress = progressText.split('/').map(element => parseInt(element.trim()));
    let amountRemaining = progress[1] - progress[0];
    return getTokens >= dungeonCost * amountRemaining;
}

function playerHasPokeballForPokemonQuest(pokeball, progressText = null) {
    let amountRemaining = 0;
    if (progressText) {
        const progress = progressText.split('/').map(element => parseInt(element.trim()));
        amountRemaining = progress[1] - progress[0];
    } else {
        amountRemaining = 1;
    }
    return App.game.pokeballs.pokeballs[pokeball].quantity() >= amountRemaining;
}

function playerSetAlreadyCaughtPokeball(pokeball) {
    if (App.game.pokeballs.alreadyCaughtSelection !== pokeball) {
        App.game.pokeballs._alreadyCaughtSelection(pokeball);
    }
}

function stopAutoDungeon() {
    if(dungeonStart && !dungeonStart.classList.contains("btn-danger")) {
        dungeonStart.click();
    }
}

function stopAutoGym() {
    if(gymStart && !gymStart.classList.contains("btn-danger")) {
        gymStart.click();
    }
}

function setAlolaSubRegion(locationName) {
    //TODO: Find a solution to retrieve locations by sub-region in a programmatic way
    //On Alola map subregion not available on Town, Route or Dungeon
    //Location found from https://github.com/pokeclicker/pokeclicker/blob/ff8b53478cf714c61de8b33d73cd1275ce785688/src/components/AlolaSVG.html
    const alolaSubregion0 = ["Route 1", "Route 1 Hau'oli Outskirts", "Route 2", "Route 3", "Melemele Sea", "Kala'e Bay", "Iki Town Outskirts", "Iki Town", "Professor Kukui\'s Lab", "Hau'oli City", "Melemele Woods", "Roadside Motel", "Trainers School", "Hau'oli Cemetery", "Seaward Cave", "Ten Carat Hill"];
    const alolaSubregion1 = ["Route 4", "Route 5", "Route 6", "Route 7", "Route 8", "Route 9", "Akala Outskirts", "Heahea City", "Paniola Town", "Royal Avenue", "Konikoni City", "Aether Paradise", "Roadside Motel", "Pikachu Valley", "Paniola Ranch", "Brooklet Hill", "Wela Volcano Park", "Lush Jungle", "Diglett's Tunnel", "Memorial Hill", "Aether Foundation", "Ruins of Life"];
    const alolaSubregion2 = ["Route 10", "Mount Hokulani", "Route 11", "Route 12", "Route 13", "Haina Desert", "Route 14", "Route 15", "Route 16", "Route 17", "Poni Wilds", "Ancient Poni Path", "Poni Breaker Coast", "Poni Grove", "Poni Plains", "Poni Coast", "Poni Gauntlet", "Aether Paradise", "Malie City", "Tapu Village", "Seafolk Village", "Exeggutor Island", "Altar of the Sunne and Moone", "Pokémon League Alola", "Vast Poni Canyon", "Lake of the Sunne and Moone"];

    if(alolaSubregion0.includes(locationName)) {
        player.subregion = 0
    } else if(alolaSubregion1.includes(locationName)) {
        player.subregion = 1
    } else if(alolaSubregion2.includes(locationName)) {
        player.subregion = 2
    }
}