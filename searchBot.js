require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});


const serectKye = process.env.OPENAI_API_KEY;
const searchKey = process.env.Tavily;

const openai = new OpenAI({apiKey:serectKye});

async function askQuestion(question) {

    return new Promise((resolve, reject) => {
        readline.question(question, (answer) => {
            resolve(answer);
        })
    })

}

const instructions_old=`You are a finance expert. 
Your goal is to provide answers based on information from the internet. 
You must use the provided Tavily search API function to find relevant online information. 
You should never use your own knowledge to answer questions.
Please translate your response into Korean.
Please include relevant url sources in the end of your answers.
Please print the response in the  JSON form {Question:", Answer:", Source:"} 

`

const instructions=`You are a finance expert. 
Your goal is to provide answers based on information from the internet. 
You must use the provided Tavily search API function to find relevant online information. 
You should never use your own knowledge to answer questions.
Please include relevant url sources in the end of your answers.

`

async function wait_for_run_completion(thread_id, run_id) {

    console.log("waiting for completion...");

    while(true){

        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const run = await openai.beta.threads.runs.retrieve(thread_id,run_id);
        
        console.log("wait_for_run_completion status:",run.status);
       
        const runStatus = ['completed', 'failed', 'requires_action'];

        if(runStatus.includes(run.status)){
            return run;
        }



    
    }
    
}

async function tavily_search(query) {

    console.log("tavily_search query:",query);

    let search="";

    const param={
        "api_key": searchKey,
        "query": query,
        "search_depth": "advanced",
        "max_tokens":8000
       

    }

    console.log("param:",param);


    const url="https://api.tavily.com/search";

    try {

        const {data} = await axios.post(url, param);

        console.log("data:",data);

        search=JSON.stringify(data.results)
        
    } catch (error) {
        
        search="error"
    }


    return search;
    
}

async function submit_tool_outputs(thread_id, run_id, tools_to_call) {

    console.log("submitting tool outputs...");
    console.log("thread_id:",thread_id);
    console.log("run_id:",run_id);
    console.log("tools_to_call:",tools_to_call);

    let tool_output_array = []

 for (let index = 0; index < tools_to_call.length; index++) {
    
    const tool = tools_to_call[index];
    console.log("tool:",tool);

        let output = null;
        const tool_call_id = tool.id
        const function_name = tool.function.name
        const function_args = tool.function.arguments

        if(function_name === "tavily_search"){

            let parsedObject = JSON.parse(function_args);

            console.log("parsedObject:",parsedObject);
            
            const query = parsedObject.query;

            console.log("query:",query);
            
            output = await tavily_search(query);

            console.log("output:",output);
        }

        if(output != null){

            console.log("add tool_output_array:",output);

            tool_output_array.push({"tool_call_id": tool_call_id, "output": output});
        }     
    
}

    console.log("tool_output_array:",tool_output_array);

    const result = await openai.beta.threads.runs.submitToolOutputs(thread_id, run_id, {tool_outputs:tool_output_array});

    return result


}

async function print_messages_from_thread(run_id,thread_id) {

    console.log("print_messages_from_thread",thread_id);

    const messages = await openai.beta.threads.messages.list(thread_id);

    const lastMessaageForRun = messages.data.filter((message) => message.run_id === run_id && message.role === "assistant").pop();

    if(lastMessaageForRun){

        console.log(`${lastMessaageForRun.content[0].text.value}\n`);
    }else{

        console.log("no messages");
    }


}




async function main() {

    try {

        const assistant = await openai.beta.assistants.create({
            name:"Boranet Search Bot",
            instructions:instructions,
            tools:[{
                "type":"function",
                "function":{
                    "name":"tavily_search",
                    "description":"Tavily Search API",
                    "parameters":{
                        "type":"object",
                        "properties":{
                            "query":{"type":"string","description": "The search query to use. For example: 'Latest news on Nvidia stock performance'"},
                        },
                        "required":["query"]
                    }
                }
               }
           ],
            model:"gpt-4-1106-preview",
        })

        const thread = await openai.beta.threads.create();

        let keepAsking = true;

        while(keepAsking){

        const userQuestion = await askQuestion("\nYou:  ");

        await openai.beta.threads.messages.create(thread.id,{
            role:"user",
            content:userQuestion
        });

        let run = await openai.beta.threads.runs.create(thread.id,{
            assistant_id:assistant.id
        });

        run = await wait_for_run_completion(thread.id, run.id)

        console.log("main run status:",run.status);

        if(run.status === "failed"){
            
            throw new Error("run failed");

        }else if(run.status === "requires_action"){

            console.log("called action")

         run = await submit_tool_outputs(thread.id, run.id, run.required_action.submit_tool_outputs.tool_calls)
         run = await wait_for_run_completion(thread.id, run.id)
        
        }


        await print_messages_from_thread(run.id,thread.id)


        const continueAsking = await askQuestion("다른 질문이 있습니까 (yes/no)?");

            keepAsking = continueAsking.toLowerCase() === "yes";

            if(!keepAsking){

               console.log("안녕 친구, 또 만나요");
               return;
            }



      }
        
    } catch (error) {
        
    console.log(error);
    
    }

    
    
}

main()